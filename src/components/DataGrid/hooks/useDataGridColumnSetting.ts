/**
 * 组合函数名称：DataGrid 表格配置
 * 使用场景：管理 DataGrid 全部列的配置缓存、代码变更合并、应用、重置和弹窗草稿。
 */

import type { GridApi } from 'ag-grid-community'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getDataGridDiagnosticErrorMessage, type DataGridDiagnosticInput } from '../diagnostics'
import {
  createDataGridDefaultColumnSettingStates,
  createDataGridColumnSettingItems,
  createDataGridColumnSettingStates,
  isDataGridColumnSummaryEnabledByDefault,
  mergeDataGridColumnSettingStates,
  toAgGridColumnState,
} from '../columnSetting'
import {
  createDataGridColumnSettingRepository,
  DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
} from '../repository/columnSettingRepository'
import { useDataGridRuntimeConfig } from '../runtimeConfig'
import type {
  DataGridColumn,
  DataGridColumnSettingChange,
  DataGridColumnSettingConfig,
  DataGridColumnSettingItem,
  DataGridColumnSettingOverride,
  DataGridColumnSettingOverrides,
  DataGridColumnSettingState,
  DataGridRow,
} from '../types'

/**
 * 用户直接操作表格时可能修改的列配置维度。
 *
 * - `order`：列顺序。
 * - `visibility`：列显隐状态。
 * - `width`：列宽及其关联的弹性宽度状态。
 * - `fixed`：列固定位置。
 * - `summary`：列合计状态。
 */
type DataGridColumnSettingScope = 'order' | 'visibility' | 'width' | 'fixed' | 'summary'

/** DataGrid 表格配置组合函数的依赖参数。 */
interface UseDataGridColumnSettingOptions<Row extends DataGridRow> {
  /** 返回当前 AG Grid API。 */
  getApi: () => GridApi<Row> | undefined

  /** 返回当前业务列配置。 */
  getColumns: () => DataGridColumn<Row>[]

  /** 返回当前用户级列配置。 */
  getConfig: () => false | DataGridColumnSettingConfig

  /** 列状态持久化或重置后的回调。 */
  onChange: (change: DataGridColumnSettingChange) => void

  /** 列合计配置变化后的回调。 */
  onSummaryChange: (fields: Set<string>) => void

  /** 报告列配置运行期间发现的开发诊断。 */
  reportDiagnostic: (diagnostic: DataGridDiagnosticInput) => void
}

export function useDataGridColumnSetting<Row extends DataGridRow>(
  options: UseDataGridColumnSettingOptions<Row>,
) {
  const runtimeConfig = useDataGridRuntimeConfig()
  const dataGridColumnSettingRepository = createDataGridColumnSettingRepository({
    driver: runtimeConfig.storageDriver,
  })
  const dialogVisible = ref(false)
  const dialogColumns = ref<DataGridColumnSettingItem[]>([])
  const dialogMinVisibleCount = ref(1)
  const applying = ref(false)
  const initializedKey = ref('')
  const summaryFields = ref<Set<string>>(new Set())
  const overrides = ref<DataGridColumnSettingOverrides>({ columns: [] })
  const pendingScopes = new Set<DataGridColumnSettingScope>()
  const pendingFields = new Map<DataGridColumnSettingScope, Set<string>>()
  let persistTimer: ReturnType<typeof setTimeout> | undefined

  const storageKey = computed(() => {
    const config = options.getConfig()
    if (!config) {
      return ''
    }
    let tenantId: string | number = 'default'
    let userId: string | number = 'anonymous'
    try {
      const scope = runtimeConfig.resolvePersistenceScope()
      tenantId = scope.tenantId ?? 'default'
      userId = scope.userId ?? 'anonymous'
    } catch (error) {
      options.reportDiagnostic({
        code: 'DG-SETTING-008',
        level: 'warning',
        message: '无法解析当前持久化作用域，列配置将使用默认租户和匿名用户空间。',
        suggestion: '检查 DataGridPlugin.resolvePersistenceScope 是否可以稳定返回租户和用户标识。',
        dedupeKey: 'persistence-scope',
        context: { reason: getDataGridDiagnosticErrorMessage(error) },
      })
    }
    return `data-grid:columns:${String(tenantId)}:${String(userId)}:${config.key}`
  })

  function getCurrentStates() {
    const api = options.getApi()
    return api
      ? createDataGridColumnSettingStates(
          api.getColumnState(),
          options.getColumns(),
          summaryFields.value,
        )
      : []
  }

  function getDefaultSummaryFields() {
    return new Set(
      options
        .getColumns()
        .filter((column) => isDataGridColumnSummaryEnabledByDefault(column))
        .map((column) => String(column.field)),
    )
  }

  function createOverrides(
    states: DataGridColumnSettingState[],
    scope: DataGridColumnSettingScope,
    targetFields?: ReadonlySet<string>,
  ): DataGridColumnSettingOverrides {
    const columns = options.getColumns()
    const configurableFields = new Set(
      columns
        .filter((column) => column.configurable !== false)
        .map((column) => String(column.field)),
    )
    const defaultStates = createDataGridDefaultColumnSettingStates(columns)
    const defaultMap = new Map(defaultStates.map((item) => [item.field, item]))
    const currentMap = new Map(states.map((item) => [item.field, item]))
    const overrideMap = new Map(
      overrides.value.columns
        .filter((item) => configurableFields.has(item.field))
        .map((item) => [item.field, { ...item }]),
    )

    configurableFields.forEach((field) => {
      const current = currentMap.get(field)
      const defaultState = defaultMap.get(field)
      if (!current || !defaultState) {
        overrideMap.delete(field)
        return
      }
      const override: DataGridColumnSettingOverride = overrideMap.get(field) ?? { field }
      const targeted = !targetFields || targetFields.has(field)
      if (scope === 'visibility' && targeted) {
        if (current.hide === defaultState.hide) {
          delete override.hide
        } else {
          override.hide = current.hide
        }
      }
      if (scope === 'width' && targeted) {
        const currentFlex = current.flex ?? null
        const defaultFlex = defaultState.flex ?? null
        if (current.width === defaultState.width && currentFlex === defaultFlex) {
          delete override.width
          delete override.flex
        } else {
          override.width = current.width
          override.flex = currentFlex
        }
      }
      if (scope === 'fixed' && targeted) {
        if (current.fixed === defaultState.fixed) {
          delete override.fixed
        } else {
          override.fixed = current.fixed
        }
      }
      if (scope === 'summary' && targeted) {
        if (Boolean(current.summary) === Boolean(defaultState.summary)) {
          delete override.summary
        } else {
          override.summary = Boolean(current.summary)
        }
      }
      if (Object.keys(override).length === 1) {
        overrideMap.delete(field)
      } else {
        overrideMap.set(field, override)
      }
    })

    let order = overrides.value.order?.filter((field) => configurableFields.has(field))
    if (scope === 'order') {
      const currentOrder = states
        .filter((item) => configurableFields.has(item.field))
        .map((item) => item.field)
      const defaultOrder = defaultStates
        .filter((item) => configurableFields.has(item.field))
        .map((item) => item.field)
      order =
        currentOrder.length === defaultOrder.length &&
        currentOrder.every((field, index) => field === defaultOrder[index])
          ? undefined
          : currentOrder
    }
    return {
      order,
      columns: [...overrideMap.values()],
    }
  }

  function markPending(scope: DataGridColumnSettingScope, fields?: readonly string[]) {
    const wasPendingForAllFields = pendingScopes.has(scope) && !pendingFields.has(scope)
    pendingScopes.add(scope)
    if (!fields?.length || wasPendingForAllFields) {
      pendingFields.delete(scope)
      return
    }
    const scopedFields = pendingFields.get(scope) ?? new Set<string>()
    fields.forEach((field) => scopedFields.add(field))
    pendingFields.set(scope, scopedFields)
  }

  function applyPendingOverrides(states: DataGridColumnSettingState[]) {
    pendingScopes.forEach((scope) => {
      overrides.value = createOverrides(states, scope, pendingFields.get(scope))
    })
    pendingScopes.clear()
    pendingFields.clear()
  }

  function hasOverrides(value: DataGridColumnSettingOverrides) {
    return Boolean(value.order?.length || value.columns.length)
  }

  function applySummaryFields(states: DataGridColumnSettingState[]) {
    summaryFields.value = new Set(states.filter((item) => item.summary).map((item) => item.field))
    options.onSummaryChange(new Set(summaryFields.value))
  }

  function readCache() {
    const config = options.getConfig()
    if (!config || !storageKey.value) {
      return
    }
    const cleanupResult = dataGridColumnSettingRepository.cleanupOnce()
    if (cleanupResult.errors.length) {
      options.reportDiagnostic({
        code: 'DG-SETTING-006',
        level: 'warning',
        message: '清理列配置缓存时部分存储操作失败，不影响当前表格继续使用。',
        suggestion: '检查浏览器存储权限和存储配额。',
        dedupeKey: 'cleanup',
        context: {
          reason: getDataGridDiagnosticErrorMessage(cleanupResult.errors[0]),
          errorCount: cleanupResult.errors.length,
        },
      })
    }
    const result = dataGridColumnSettingRepository.get({
      storageKey: storageKey.value,
      revision: config.revision ?? 1,
    })
    if (result.status === 'hit') {
      if (result.error) {
        options.reportDiagnostic({
          code: 'DG-SETTING-006',
          level: 'warning',
          message: '更新列配置最近访问时间失败，当前缓存仍可正常使用。',
          suggestion: '检查浏览器存储权限和存储配额。',
          dedupeKey: `touch:${storageKey.value}`,
          context: { reason: getDataGridDiagnosticErrorMessage(result.error) },
        })
      }
      return result.cache
    }
    if (result.status === 'version-incompatible') {
      options.reportDiagnostic({
        code: 'DG-SETTING-004',
        level: 'info',
        message: '列配置缓存版本不受支持，已删除并使用代码默认配置。',
        dedupeKey: storageKey.value,
        context: {
          cacheVersion: result.cacheVersion,
          supportedVersion: DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
        },
      })
    } else if (result.status === 'revision-incompatible') {
      options.reportDiagnostic({
        code: 'DG-SETTING-005',
        level: 'info',
        message: '列配置 revision 已变化，旧缓存已删除。',
        dedupeKey: storageKey.value,
        context: { cacheRevision: result.cacheRevision, revision: config.revision ?? 1 },
      })
    } else if (result.status === 'invalid') {
      options.reportDiagnostic({
        code: 'DG-SETTING-003',
        level: 'warning',
        message: '列配置缓存结构无效，已删除并使用代码默认配置。',
        suggestion: '检查是否有旧代码或外部逻辑写入了相同的 columnSetting.key。',
        dedupeKey: storageKey.value,
      })
    } else if (result.status === 'storage-error') {
      options.reportDiagnostic({
        code: 'DG-SETTING-006',
        level: 'warning',
        message: '读取列配置缓存失败，已继续使用代码默认配置。',
        suggestion: '检查浏览器存储权限和存储配额。',
        dedupeKey: `read:${storageKey.value}`,
        context: { reason: getDataGridDiagnosticErrorMessage(result.error) },
      })
    }
    return
  }

  function writeCache() {
    const config = options.getConfig()
    if (!config || !storageKey.value) {
      return
    }
    if (!hasOverrides(overrides.value)) {
      const result = dataGridColumnSettingRepository.remove(storageKey.value)
      if (!result.ok) {
        options.reportDiagnostic({
          code: 'DG-SETTING-006',
          level: 'warning',
          message: '删除已恢复默认值的列配置缓存失败，刷新页面后旧配置可能再次生效。',
          suggestion: '检查浏览器存储权限和存储配额。',
          dedupeKey: `remove-default:${storageKey.value}`,
          context: { reason: getDataGridDiagnosticErrorMessage(result.error) },
        })
      }
      return
    }
    const result = dataGridColumnSettingRepository.set({
      storageKey: storageKey.value,
      revision: config.revision ?? 1,
      data: { overrides: overrides.value },
    })
    if (!result.ok) {
      // localStorage 不可用时保留当前表格状态，不阻塞用户继续操作。
      options.reportDiagnostic({
        code: 'DG-SETTING-006',
        level: 'warning',
        message: '写入列配置缓存失败，当前调整仅在本次页面生命周期内有效。',
        suggestion: '检查浏览器存储权限和存储配额。',
        dedupeKey: `write:${storageKey.value}`,
        context: { reason: getDataGridDiagnosticErrorMessage(result.error) },
      })
    }
  }

  function applyStates(states: DataGridColumnSettingState[]) {
    const api = options.getApi()
    if (!api) {
      return false
    }
    applySummaryFields(states)
    applying.value = true
    const applied = api.applyColumnState({
      state: toAgGridColumnState(states),
      applyOrder: true,
    })
    if (!applied) {
      options.reportDiagnostic({
        code: 'DG-SETTING-007',
        level: 'warning',
        message: 'AG Grid 未能完整应用列配置，部分缓存字段可能已失效。',
        suggestion: '检查 columns 是否存在重复 field，或缓存中是否包含已删除字段。',
        dedupeKey: storageKey.value,
      })
    }
    nextTick(() => {
      applying.value = false
    })
    return applied
  }

  function refreshDialogColumns() {
    const states = getCurrentStates()
    const columns = options.getColumns()
    const columnMap = new Map(columns.map((column) => [String(column.field), column]))
    const fixedVisibleCount = states.filter(
      (item) => !item.hide && columnMap.get(item.field)?.configurable === false,
    ).length
    const config = options.getConfig()
    const configuredMinimum = config ? Math.max(1, config.minVisibleCount ?? 1) : 1
    dialogMinVisibleCount.value = Math.max(0, configuredMinimum - fixedVisibleCount)
    dialogColumns.value = createDataGridColumnSettingItems(states, columns)
  }

  function initialize() {
    const api = options.getApi()
    const config = options.getConfig()
    if (!api || !config) {
      return
    }
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    pendingScopes.clear()
    pendingFields.clear()
    summaryFields.value = getDefaultSummaryFields()
    const defaultStates = createDataGridDefaultColumnSettingStates(options.getColumns())
    const cache = readCache()
    if (cache) {
      overrides.value = cache.data.overrides
      applyStates(
        mergeDataGridColumnSettingStates(
          defaultStates,
          overrides.value,
          options.getColumns(),
          config.minVisibleCount ?? 1,
        ),
      )
    } else {
      overrides.value = { columns: [] }
      applySummaryFields(defaultStates)
    }
    initializedKey.value = storageKey.value
    refreshDialogColumns()
  }

  function getInitialStates() {
    const config = options.getConfig()
    const columns = options.getColumns()
    const defaultStates = createDataGridDefaultColumnSettingStates(columns)
    if (!config) {
      return defaultStates
    }
    const cache = readCache()
    overrides.value = cache?.data.overrides ?? { columns: [] }
    return cache
      ? mergeDataGridColumnSettingStates(
          defaultStates,
          overrides.value,
          columns,
          config.minVisibleCount ?? 1,
        )
      : defaultStates
  }

  function persist(
    source: DataGridColumnSettingChange['source'],
    scope?: DataGridColumnSettingScope,
    fields?: readonly string[],
  ) {
    if (!options.getConfig() || applying.value) {
      return
    }
    if (scope) {
      markPending(scope, fields)
    }
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    if (!pendingScopes.size) {
      return
    }
    const states = getCurrentStates()
    applyPendingOverrides(states)
    writeCache()
    options.onChange({ source, columns: states })
  }

  function schedulePersist(scope: DataGridColumnSettingScope, fields?: readonly string[]) {
    if (!options.getConfig() || applying.value) {
      return
    }
    markPending(scope, fields)
    if (persistTimer) {
      clearTimeout(persistTimer)
    }
    persistTimer = setTimeout(() => persist('grid'), 200)
  }

  function open() {
    if (!options.getConfig()) {
      return
    }
    refreshDialogColumns()
    dialogVisible.value = true
  }

  function close() {
    dialogVisible.value = false
  }

  function save(items: DataGridColumnSettingItem[]) {
    const currentStates = getCurrentStates()
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    const draftFields = new Set(items.map((item) => item.field))
    const states: DataGridColumnSettingState[] = items.map((draft) => ({
      field: draft.field,
      hide: !draft.visible,
      width: draft.width,
      flex: draft.flex ?? null,
      fixed: draft.fixed,
      summary: draft.summarizable && Boolean(draft.summary),
    }))
    currentStates.forEach((item, index) => {
      if (!draftFields.has(item.field)) {
        states.splice(Math.min(index, states.length), 0, item)
      }
    })
    const config = options.getConfig()
    applyPendingOverrides(states)
    overrides.value = createOverrides(states, 'order')
    overrides.value = createOverrides(states, 'visibility')
    overrides.value = createOverrides(states, 'fixed')
    overrides.value = createOverrides(states, 'summary')
    const defaultStates = createDataGridDefaultColumnSettingStates(options.getColumns())
    const merged = config
      ? mergeDataGridColumnSettingStates(
          defaultStates,
          overrides.value,
          options.getColumns(),
          config.minVisibleCount ?? 1,
        )
      : states
    applyStates(merged)
    writeCache()
    options.onChange({ source: 'save', columns: merged })
    close()
  }

  function reset() {
    const api = options.getApi()
    if (!api) {
      return
    }
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    pendingScopes.clear()
    pendingFields.clear()
    overrides.value = { columns: [] }
    if (storageKey.value) {
      const result = dataGridColumnSettingRepository.remove(storageKey.value)
      if (!result.ok) {
        // 缓存删除失败不应阻止当前表格恢复默认列状态。
        options.reportDiagnostic({
          code: 'DG-SETTING-006',
          level: 'warning',
          message: '删除列配置缓存失败，刷新页面后旧配置可能再次生效。',
          suggestion: '检查浏览器存储权限和存储配额。',
          dedupeKey: `remove:${storageKey.value}`,
          context: { reason: getDataGridDiagnosticErrorMessage(result.error) },
        })
      }
    }
    const defaultStates = createDataGridDefaultColumnSettingStates(options.getColumns())
    applyStates(defaultStates)
    summaryFields.value = getDefaultSummaryFields()
    options.onSummaryChange(new Set(summaryFields.value))
    nextTick(() => {
      refreshDialogColumns()
    })
    options.onChange({ source: 'reset', columns: defaultStates })
  }

  watch(storageKey, (value) => {
    if (value && value !== initializedKey.value) {
      nextTick(initialize)
    }
  })

  onBeforeUnmount(() => {
    if (persistTimer) {
      persist('grid')
    }
  })

  return {
    dialogVisible,
    dialogColumns,
    dialogMinVisibleCount,
    getInitialStates,
    initialize,
    persist,
    schedulePersist,
    open,
    close,
    save,
    reset,
  }
}
