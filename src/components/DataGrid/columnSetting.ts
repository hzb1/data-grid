import type { ColumnState } from 'ag-grid-community'
import type {
  DataGridColumn,
  DataGridColumnFixed,
  DataGridColumnSettingItem,
  DataGridColumnSettingOverride,
  DataGridColumnSettingOverrides,
  DataGridColumnSettingState,
  DataGridRow,
} from './types'

function normalizeFixed(value: unknown): DataGridColumnFixed {
  return value === 'left' || value === 'right' ? value : null
}

function normalizeFlex(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function clampWidth<Row extends DataGridRow>(width: number, column: DataGridColumn<Row>) {
  return Math.min(
    column.maxWidth ?? Number.POSITIVE_INFINITY,
    Math.max(column.minWidth ?? 40, width),
  )
}

export function isDataGridNumericColumn<Row extends DataGridRow>(column: DataGridColumn<Row>) {
  return (
    column.searchType === 'number' ||
    column.searchType === 'numberRange' ||
    (column.editor && column.editor.type === 'number') ||
    Boolean(column.summary)
  )
}

/** 判断当前列是否包含必填校验规则。 */
export function isDataGridRequiredColumn<Row extends DataGridRow>(column: DataGridColumn<Row>) {
  return Boolean(column.rules?.some((rule) => rule.required))
}

/** 判断当前列是否应按照代码配置默认参与合计。 */
export function isDataGridColumnSummaryEnabledByDefault<Row extends DataGridRow>(
  column: DataGridColumn<Row>,
) {
  return column.summary !== false && isDataGridNumericColumn(column)
}

export function createDataGridDefaultColumnSettingStates<Row extends DataGridRow>(
  columns: DataGridColumn<Row>[],
): DataGridColumnSettingState[] {
  return columns.map((column) => ({
    field: String(column.field),
    hide: isDataGridRequiredColumn(column) ? false : column.initialVisible === false,
    width: clampWidth(column.width ?? column.minWidth ?? 200, column),
    flex: normalizeFlex(column.flex),
    fixed: normalizeFixed(column.fixed),
    summary: isDataGridColumnSummaryEnabledByDefault(column),
  }))
}

export function createDataGridColumnSettingStates<Row extends DataGridRow>(
  state: ColumnState[],
  columns: DataGridColumn<Row>[],
  summaryFields?: ReadonlySet<string>,
): DataGridColumnSettingState[] {
  const columnMap = new Map(columns.map((column) => [String(column.field), column]))
  return state.flatMap<DataGridColumnSettingState>((item) => {
    const column = columnMap.get(item.colId)
    if (!column) {
      return []
    }
    return [
      {
        field: item.colId,
        hide: Boolean(item.hide),
        width: clampWidth(item.width ?? column.width ?? column.minWidth ?? 200, column),
        flex: normalizeFlex(item.flex),
        fixed: normalizeFixed(item.pinned),
        summary: summaryFields ? summaryFields.has(item.colId) : Boolean(column.summary),
      },
    ]
  })
}

export function createDataGridColumnSettingItems<Row extends DataGridRow>(
  state: DataGridColumnSettingState[],
  columns: DataGridColumn<Row>[],
): DataGridColumnSettingItem[] {
  const columnMap = new Map(columns.map((column) => [String(column.field), column]))
  const defaultStates = createDataGridDefaultColumnSettingStates(columns)
  const defaultMap = new Map(defaultStates.map((item) => [item.field, item]))
  const defaultIndexMap = new Map(defaultStates.map((item, index) => [item.field, index]))
  return state.flatMap<DataGridColumnSettingItem>((item) => {
    const column = columnMap.get(item.field)
    const defaultState = defaultMap.get(item.field)
    if (!column || !defaultState || column.configurable === false) {
      return []
    }
    return [
      {
        ...item,
        title: column.title,
        defaultState: { ...defaultState },
        defaultIndex: defaultIndexMap.get(item.field) ?? 0,
        visible: isDataGridRequiredColumn(column) ? true : !item.hide,
        configurable: true,
        hideable: column.hideable !== false && !isDataGridRequiredColumn(column),
        summarizable: isDataGridNumericColumn(column),
      },
    ]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseDataGridColumnSettingOverrides(
  value: unknown,
): DataGridColumnSettingOverrides | undefined {
  if (
    !isRecord(value) ||
    !Array.isArray(value.columns) ||
    (value.order !== undefined && !Array.isArray(value.order))
  ) {
    return
  }
  const fields = new Set<string>()
  const columns: DataGridColumnSettingOverride[] = []
  for (const item of value.columns) {
    if (
      !isRecord(item) ||
      typeof item.field !== 'string' ||
      fields.has(item.field) ||
      (item.hide !== undefined && typeof item.hide !== 'boolean') ||
      (item.width !== undefined &&
        (typeof item.width !== 'number' || !Number.isFinite(item.width) || item.width <= 0)) ||
      (item.flex !== undefined &&
        item.flex !== null &&
        (typeof item.flex !== 'number' || !Number.isFinite(item.flex) || item.flex <= 0)) ||
      (item.summary !== undefined && typeof item.summary !== 'boolean') ||
      (item.fixed !== undefined &&
        ![null, 'left', 'right'].includes(item.fixed as DataGridColumnFixed))
    ) {
      return
    }
    fields.add(item.field)
    columns.push({
      field: item.field,
      hide: item.hide as boolean | undefined,
      width: item.width as number | undefined,
      flex: item.flex === undefined ? undefined : normalizeFlex(item.flex),
      fixed: item.fixed === undefined ? undefined : normalizeFixed(item.fixed),
      summary: typeof item.summary === 'boolean' ? item.summary : undefined,
    })
  }
  const order = value.order as unknown[] | undefined
  if (
    order &&
    (order.some((field) => typeof field !== 'string') || new Set(order).size !== order.length)
  ) {
    return
  }
  return {
    order: order as string[] | undefined,
    columns,
  }
}

function insertNewColumns(cachedFields: string[], defaultFields: string[]) {
  const orderedFields = cachedFields.slice()
  defaultFields.forEach((field, index) => {
    if (orderedFields.includes(field)) {
      return
    }
    const nextField = defaultFields
      .slice(index + 1)
      .find((candidate) => orderedFields.includes(candidate))
    if (nextField) {
      orderedFields.splice(orderedFields.indexOf(nextField), 0, field)
      return
    }
    const previousField = defaultFields
      .slice(0, index)
      .reverse()
      .find((candidate) => orderedFields.includes(candidate))
    const previousIndex = previousField ? orderedFields.indexOf(previousField) : -1
    orderedFields.splice(previousIndex + 1, 0, field)
  })
  return orderedFields
}

function enforceMinimumVisible<Row extends DataGridRow>(
  states: DataGridColumnSettingState[],
  minVisibleCount: number,
  columns: Map<string, DataGridColumn<Row>>,
) {
  let visibleCount = states.filter((item) => !item.hide).length
  if (visibleCount >= minVisibleCount) {
    return
  }
  states.forEach((item) => {
    const column = columns.get(item.field)
    if (
      visibleCount < minVisibleCount &&
      item.hide &&
      column?.configurable !== false &&
      column?.hideable !== false
    ) {
      item.hide = false
      visibleCount += 1
    }
  })
}

export function mergeDataGridColumnSettingStates<Row extends DataGridRow>(
  defaultStates: DataGridColumnSettingState[],
  overrides: DataGridColumnSettingOverrides,
  columns: DataGridColumn<Row>[],
  minVisibleCount: number,
) {
  const columnMap = new Map(columns.map((column) => [String(column.field), column]))
  const defaultMap = new Map(defaultStates.map((item) => [item.field, item]))
  const overrideMap = new Map(
    overrides.columns.filter((item) => columnMap.has(item.field)).map((item) => [item.field, item]),
  )
  const defaultFields = defaultStates.map((item) => item.field)
  const cachedOrder = overrides.order?.filter((field) => columnMap.has(field))
  const orderedFields = cachedOrder ? insertNewColumns(cachedOrder, defaultFields) : defaultFields
  const states = orderedFields.flatMap<DataGridColumnSettingState>((field) => {
    const column = columnMap.get(field)
    const defaultState = defaultMap.get(field)
    if (!column || !defaultState) {
      return []
    }
    const override = overrideMap.get(field)
    if (!override || column.configurable === false) {
      return [{ ...defaultState }]
    }
    return [
      {
        field,
        hide: isDataGridRequiredColumn(column)
          ? false
          : column.hideable === false
            ? defaultState.hide
            : (override.hide ?? defaultState.hide),
        width:
          override.width === undefined ? defaultState.width : clampWidth(override.width, column),
        flex: override.flex === undefined ? (defaultState.flex ?? null) : override.flex,
        fixed: override.fixed === undefined ? defaultState.fixed : override.fixed,
        summary: isDataGridNumericColumn(column)
          ? (override.summary ?? defaultState.summary ?? false)
          : false,
      },
    ]
  })
  defaultFields.forEach((field, index) => {
    if (columnMap.get(field)?.configurable !== false) {
      return
    }
    const currentIndex = states.findIndex((item) => item.field === field)
    if (currentIndex < 0 || currentIndex === index) {
      return
    }
    const [state] = states.splice(currentIndex, 1)
    states.splice(Math.min(index, states.length), 0, state)
  })
  enforceMinimumVisible(states, Math.max(1, Math.min(minVisibleCount, states.length)), columnMap)
  return states
}

export function toAgGridColumnState(state: DataGridColumnSettingState[]): ColumnState[] {
  return state.map((item) => ({
    colId: item.field,
    hide: item.hide,
    width: item.width,
    flex: item.flex ?? null,
    pinned: item.fixed,
  }))
}
