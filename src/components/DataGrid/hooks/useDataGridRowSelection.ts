/**
 * 组合函数名称：DataGrid 行选择
 * 使用场景：管理 DataGrid 单选、多选、受控行标识、跨数据保留和 AG Grid 选择状态同步。
 */

import type {
  ColDef,
  GridApi,
  RowSelectionOptions,
  SelectionChangedEvent,
  SelectionColumnDef,
  SelectionEventSourceType,
} from 'ag-grid-community'
import { computed, nextTick, ref, watch } from 'vue'
import DataGridRowRadio from '../DataGridRowRadio.vue'
import { encodeDataGridRowKey, isDataGridRowKey } from '../rowKey'
import type {
  DataGridRow,
  DataGridRowKey,
  DataGridRowSelectionAction,
  DataGridRowSelectionChange,
  DataGridRowSelectionConfig,
  DataGridRowSelectionSource,
} from '../types'

/** DataGrid 内部生成的单选 Radio 列标识。 */
export const DATA_GRID_ROW_RADIO_COLUMN_ID = '__dataGridRowRadio'

/** DataGrid 行选择组合函数参数。 */
interface UseDataGridRowSelectionOptions<Row extends DataGridRow> {
  /** 获取当前 AG Grid API。 */
  getApi: () => GridApi<Row> | undefined

  /** 获取当前完整行数据。 */
  getRows: () => Row[]

  /** 获取当前行选择配置。 */
  getConfig: () => false | DataGridRowSelectionConfig<Row>

  /** 获取外部双向绑定的已选行标识。 */
  getExternalKeys: () => DataGridRowKey[]

  /** 解析指定行的稳定唯一标识。 */
  getRowKey: (row: Row, dataIndex: number) => DataGridRowKey

  /** 判断指定行是否正在使用当前 DataGrid 实例的私有身份。 */
  isInternalRowKey: (row: Row, rowKey: DataGridRowKey) => boolean

  /** 行选择状态发生业务变化时提交完整快照。 */
  onChange: (change: DataGridRowSelectionChange<Row>) => void
}

/** DataGrid 当前数据中的行标识索引项。 */
interface DataGridRowKeyEntry<Row extends DataGridRow> {
  /** 当前行数据。 */
  row: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前行的原始唯一标识。 */
  rowKey: DataGridRowKey

  /** 当前行标识的类型安全编码。 */
  token: string
}

/** 判断两个行标识序列是否完全一致。 */
function isSameRowKeys(left: DataGridRowKey[], right: DataGridRowKey[]) {
  return (
    left.length === right.length && left.every((rowKey, index) => Object.is(rowKey, right[index]))
  )
}

/** 将 AG Grid 选择来源转换为 DataGrid 稳定公共来源。 */
function resolveSelectionSource(source: SelectionEventSourceType): DataGridRowSelectionSource {
  if (source === 'checkboxSelected') return 'control'
  if (source === 'rowClicked') return 'row'
  if (source === 'spaceKey') return 'keyboard'
  if (source.startsWith('uiSelectAll')) return 'select-all'
  return 'api'
}

/** 根据选择前后状态判断本次动作。 */
function resolveSelectionAction(
  previousKeys: DataGridRowKey[],
  nextKeys: DataGridRowKey[],
): DataGridRowSelectionAction {
  if (!nextKeys.length && previousKeys.length) {
    return 'deselect'
  }
  const previousTokens = new Set(previousKeys.map(encodeDataGridRowKey))
  if (nextKeys.some((rowKey) => !previousTokens.has(encodeDataGridRowKey(rowKey)))) {
    return 'select'
  }
  const nextTokens = new Set(nextKeys.map(encodeDataGridRowKey))
  return previousKeys.some((rowKey) => !nextTokens.has(encodeDataGridRowKey(rowKey)))
    ? 'deselect'
    : 'select'
}

/** 管理 DataGrid 的业务行选择状态。 */
export function useDataGridRowSelection<Row extends DataGridRow>(
  options: UseDataGridRowSelectionOptions<Row>,
) {
  const selectedRowKeys = ref<DataGridRowKey[]>([])
  const synchronizingGrid = ref(false)
  const generatedKeyTokens = new Set<string>()

  const agRowSelection = computed<RowSelectionOptions<Row> | undefined>(() => {
    const config = options.getConfig()
    if (!config) {
      return
    }
    return {
      mode: config.mode === 'single' ? 'singleRow' : 'multiRow',
      checkboxes: config.mode === 'multiple' ? (config.showCheckbox ?? true) : false,
      enableClickSelection: config.selectOnRowClick ?? false,
      enableSelectionWithoutKeys: config.mode === 'multiple' && Boolean(config.selectOnRowClick),
      headerCheckbox: config.mode === 'multiple' ? (config.headerSelectAll ?? true) : undefined,
      selectAll: config.mode === 'multiple' ? (config.selectAll ?? 'filtered') : undefined,
      isRowSelectable: (params) => {
        if (!params.data || params.rowPinned) {
          return false
        }
        const dataIndex = findDataIndex(params.data)
        if (dataIndex < 0) {
          return false
        }
        const rowKey = options.getRowKey(params.data, dataIndex)
        return config.selectable ? config.selectable({ row: params.data, dataIndex, rowKey }) : true
      },
    } as RowSelectionOptions<Row>
  })

  const selectionColumnDef = computed<SelectionColumnDef>(() => ({
    width: 48,
    minWidth: 48,
    maxWidth: 48,
    pinned: 'left',
    lockPinned: true,
    resizable: false,
    sortable: false,
    suppressMovable: true,
    suppressHeaderMenuButton: true,
    cellClass: 'data-grid__row-selection-cell data-grid__row-selection-cell--multiple',
    headerClass: 'data-grid__row-selection-header data-grid__row-selection-header--multiple',
  }))

  const singleSelectionColumnDef = computed<ColDef<Row> | undefined>(() => {
    const config = options.getConfig()
    if (!config || config.mode !== 'single' || config.showCheckbox === false) {
      return
    }
    return {
      colId: DATA_GRID_ROW_RADIO_COLUMN_ID,
      headerName: '',
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      pinned: 'left',
      lockPinned: true,
      resizable: false,
      sortable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      cellClass: 'data-grid__row-selection-cell data-grid__row-selection-cell--single',
      headerClass: 'data-grid__row-selection-header data-grid__row-selection-header--single',
      cellRenderer: DataGridRowRadio,
    }
  })

  function findDataIndex(row: Row) {
    const directIndex = options.getRows().indexOf(row)
    if (directIndex >= 0) {
      return directIndex
    }
    const rowKey = options.getRowKey(row, -1)
    return options
      .getRows()
      .findIndex((item, index) => Object.is(options.getRowKey(item, index), rowKey))
  }

  function getRowEntries() {
    const entryMap = new Map<string, DataGridRowKeyEntry<Row>>()
    const entries = options.getRows().map<DataGridRowKeyEntry<Row>>((row, dataIndex) => {
      const rowKey = options.getRowKey(row, dataIndex)
      const token = encodeDataGridRowKey(rowKey)
      if (entryMap.has(token)) {
        throw new Error(`DataGrid rowKey 不允许重复，重复值为：${String(rowKey)}`)
      }
      if (options.isInternalRowKey(row, rowKey)) {
        generatedKeyTokens.add(token)
      }
      const entry = { row, dataIndex, rowKey, token }
      entryMap.set(token, entry)
      return entry
    })
    return { entries, entryMap }
  }

  function normalizeKeys(keys: DataGridRowKey[]) {
    const config = options.getConfig()
    const normalized: DataGridRowKey[] = []
    const tokens = new Set<string>()
    keys.forEach((rowKey) => {
      if (!isDataGridRowKey(rowKey)) {
        throw new Error(
          `DataGrid selectedRowKeys 只能包含非空字符串或有限数字，当前值为：${String(rowKey)}`,
        )
      }
      const token = encodeDataGridRowKey(rowKey)
      if (!tokens.has(token)) {
        tokens.add(token)
        normalized.push(rowKey)
      }
    })
    return config && config.mode === 'single' ? normalized.slice(0, 1) : normalized
  }

  function normalizeExternalKeys(keys: DataGridRowKey[]) {
    const config = options.getConfig()
    if (!config) {
      return []
    }
    const { entryMap } = getRowEntries()
    return normalizeKeys(
      keys.filter((rowKey) => {
        if (!isDataGridRowKey(rowKey)) {
          return true
        }
        const token = encodeDataGridRowKey(rowKey)
        const entry = entryMap.get(token)
        if (!entry) {
          return Boolean(config.reserveSelection && !generatedKeyTokens.has(token))
        }
        return config.selectable
          ? config.selectable({ row: entry.row, dataIndex: entry.dataIndex, rowKey: entry.rowKey })
          : true
      }),
    )
  }

  function getSelectedRows(keys = selectedRowKeys.value) {
    const selectedTokens = new Set(keys.map(encodeDataGridRowKey))
    return getRowEntries()
      .entries.filter((entry) => selectedTokens.has(entry.token))
      .map((entry) => entry.row)
  }

  function setGridSynchronizing(value: boolean) {
    synchronizingGrid.value = value
    if (value) {
      queueMicrotask(() => {
        synchronizingGrid.value = false
      })
    }
  }

  function applyKeysToGrid(keys: DataGridRowKey[]) {
    const api = options.getApi()
    const config = options.getConfig()
    if (!api || !config) {
      return
    }
    const selectedTokens = new Set(keys.map(encodeDataGridRowKey))
    setGridSynchronizing(true)
    api.forEachNode((node) => {
      if (!node.data || node.rowPinned) {
        return
      }
      const dataIndex = findDataIndex(node.data)
      const rowKey = options.getRowKey(node.data, dataIndex)
      node.setSelected(selectedTokens.has(encodeDataGridRowKey(rowKey)), false, 'api')
    })
  }

  function commit(
    keys: DataGridRowKey[],
    action: DataGridRowSelectionAction,
    source: DataGridRowSelectionSource,
  ) {
    const normalizedKeys = normalizeKeys(keys)
    if (isSameRowKeys(selectedRowKeys.value, normalizedKeys)) {
      return false
    }
    selectedRowKeys.value = normalizedKeys
    options.onChange({
      selectedRowKeys: [...normalizedKeys],
      selectedRows: getSelectedRows(normalizedKeys),
      action,
      source,
    })
    return true
  }

  function syncExternalKeys(keys: DataGridRowKey[]) {
    const normalizedKeys = normalizeExternalKeys(keys)
    selectedRowKeys.value = normalizedKeys
    nextTick(() => applyKeysToGrid(normalizedKeys))
  }

  function reconcileRows() {
    const config = options.getConfig()
    if (!config) {
      return
    }
    const { entryMap } = getRowEntries()
    const nextKeys = selectedRowKeys.value.filter((rowKey) => {
      const token = encodeDataGridRowKey(rowKey)
      return entryMap.has(token) || (config.reserveSelection && !generatedKeyTokens.has(token))
    })
    const normalizedKeys = normalizeKeys(nextKeys)
    if (!isSameRowKeys(selectedRowKeys.value, normalizedKeys)) {
      selectedRowKeys.value = normalizedKeys
      options.onChange({
        selectedRowKeys: [...normalizedKeys],
        selectedRows: getSelectedRows(normalizedKeys),
        action: 'prune',
        source: 'data-change',
      })
    }
    nextTick(() => applyKeysToGrid(normalizedKeys))
  }

  function collectGridSelectedKeys() {
    const config = options.getConfig()
    if (!config) {
      return []
    }
    const { entries } = getRowEntries()
    const selectedTokens = new Set(
      (options.getApi()?.getSelectedRows() ?? []).map((row) => {
        const dataIndex = findDataIndex(row)
        return encodeDataGridRowKey(options.getRowKey(row, dataIndex))
      }),
    )
    const currentKeys = entries
      .filter((entry) => selectedTokens.has(entry.token))
      .map((entry) => entry.rowKey)
    if (!config.reserveSelection || config.mode === 'single') {
      return currentKeys
    }
    const currentTokens = new Set(entries.map((entry) => entry.token))
    const reservedKeys = selectedRowKeys.value.filter(
      (rowKey) => !currentTokens.has(encodeDataGridRowKey(rowKey)),
    )
    return [...reservedKeys, ...currentKeys]
  }

  function onSelectionChanged(event: SelectionChangedEvent<Row>) {
    if (
      synchronizingGrid.value ||
      !options.getConfig() ||
      (!['checkboxSelected', 'rowClicked', 'spaceKey'].includes(event.source) &&
        !event.source.startsWith('uiSelectAll'))
    ) {
      return
    }
    const nextKeys = normalizeKeys(collectGridSelectedKeys())
    const action = resolveSelectionAction(selectedRowKeys.value, nextKeys)
    commit(nextKeys, action, resolveSelectionSource(event.source))
  }

  function setSelectedRowKeys(keys: DataGridRowKey[]) {
    const normalizedKeys = normalizeKeys(keys)
    const previousKeys = [...selectedRowKeys.value]
    applyKeysToGrid(normalizedKeys)
    commit(normalizedKeys, resolveSelectionAction(previousKeys, normalizedKeys), 'api')
  }

  function clearRowSelection() {
    if (!selectedRowKeys.value.length) {
      return
    }
    setGridSynchronizing(true)
    options.getApi()?.deselectAll('all', 'apiSelectAll')
    commit([], 'clear', 'api')
  }

  function selectAllRows() {
    const api = options.getApi()
    const config = options.getConfig()
    if (!api || !config || config.mode !== 'multiple') {
      return
    }
    setGridSynchronizing(true)
    if ((config.selectAll ?? 'filtered') === 'filtered') {
      api.selectAll('filtered', 'apiSelectAllFiltered')
    } else {
      api.selectAll('all', 'apiSelectAll')
    }
    const nextKeys = collectGridSelectedKeys()
    commit(nextKeys, 'select', 'api')
  }

  function initialize() {
    getRowEntries()
    syncExternalKeys(options.getExternalKeys())
  }

  watch(
    () => options.getExternalKeys(),
    (keys) => syncExternalKeys(keys),
    { deep: true },
  )

  watch(
    () => options.getRows(),
    () => reconcileRows(),
  )

  watch(
    () => options.getConfig(),
    (config, previousConfig) => {
      setGridSynchronizing(true)
      if (!config) {
        if (previousConfig && selectedRowKeys.value.length) {
          options.getApi()?.deselectAll('all', 'apiSelectAll')
          commit([], 'clear', 'config-change')
        }
        return
      }
      const normalizedKeys = previousConfig
        ? normalizeKeys(selectedRowKeys.value)
        : normalizeExternalKeys(options.getExternalKeys())
      if (!isSameRowKeys(selectedRowKeys.value, normalizedKeys)) {
        commit(normalizedKeys, 'prune', 'config-change')
      }
      nextTick(() => applyKeysToGrid(normalizedKeys))
    },
    { deep: true, flush: 'sync' },
  )

  return {
    agRowSelection,
    selectionColumnDef,
    singleSelectionColumnDef,
    initialize,
    onSelectionChanged,
    getSelectedRowKeys: () => [...selectedRowKeys.value],
    getSelectedRows,
    setSelectedRowKeys,
    clearRowSelection,
    selectAllRows,
  }
}
