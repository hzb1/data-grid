/**
 * 工具名称：DataGrid 单元格合并
 * 使用场景：解析连续行和连续列的展示合并区域，并为渲染、选区及剪贴板提供统一坐标。
 */

import type { GridApi } from 'ag-grid-community'
import { getFieldValue } from './utils'
import type {
  DataGridCellMergeContext,
  DataGridColumn,
  DataGridColumnMergeConfig,
  DataGridField,
  DataGridRow,
  DataGridRowMergeConfig,
} from './types'

/** DataGrid 合并区域的方向类型。 */
export type DataGridMergeKind = 'row' | 'column'

/** DataGrid 合并区域中的单元格坐标。 */
export interface DataGridMergePoint {
  /** 当前坐标在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前坐标对应的业务列字段。 */
  columnId: string
}

/** DataGrid 已解析的矩形合并区域。 */
export interface DataGridMergeRange {
  /** 当前区域的合并方向。 */
  kind: DataGridMergeKind

  /** 当前合并区域左上角坐标。 */
  start: DataGridMergePoint

  /** 当前合并区域右下角坐标。 */
  end: DataGridMergePoint
}

/** DataGrid 合并解析器需要访问的表格状态。 */
export interface DataGridMergeResolver<Row extends DataGridRow> {
  /** 返回当前 AG Grid 实例。 */
  getApi: () => GridApi<Row> | undefined

  /** 返回当前完整业务列配置。 */
  getColumns: () => DataGridColumn<Row>[]

  /** 返回指定业务行在原始受控数组中的位置。 */
  getDataIndex: (row: Row) => number
}

/** 判断相邻业务行是否符合当前列的行合并规则。 */
function isSameRowMergeGroup<Row extends DataGridRow>(
  current: Row,
  previous: Row,
  column: DataGridColumn<Row>,
  config: true | DataGridRowMergeConfig<Row>,
) {
  if (config !== true && config.equals) {
    return config.equals(current, previous)
  }
  const fields = config !== true && config.by?.length ? config.by : [column.field]
  return fields.every((field) =>
    Object.is(getFieldValue(current, field), getFieldValue(previous, field)),
  )
}

/** 返回指定展示行在当前列中的完整纵向合并区域。 */
function resolveRowMergeRange<Row extends DataGridRow>(
  resolver: DataGridMergeResolver<Row>,
  column: DataGridColumn<Row>,
  displayIndex: number,
): DataGridMergeRange | undefined {
  const config = column.rowMerge
  const api = resolver.getApi()
  const currentNode = api?.getDisplayedRowAtIndex(displayIndex)
  const currentRow = currentNode?.data
  if (!config || !api || !currentRow || currentNode.rowPinned) {
    return
  }

  let startDisplayIndex = displayIndex
  while (startDisplayIndex > 0) {
    const previousRow = api.getDisplayedRowAtIndex(startDisplayIndex - 1)?.data
    if (!previousRow || !isSameRowMergeGroup(currentRow, previousRow, column, config)) {
      break
    }
    startDisplayIndex -= 1
  }

  let endDisplayIndex = displayIndex
  while (endDisplayIndex < api.getDisplayedRowCount() - 1) {
    const nextRow = api.getDisplayedRowAtIndex(endDisplayIndex + 1)?.data
    if (!nextRow || !isSameRowMergeGroup(currentRow, nextRow, column, config)) {
      break
    }
    endDisplayIndex += 1
  }

  return {
    kind: 'row',
    start: { displayIndex: startDisplayIndex, columnId: String(column.field) },
    end: { displayIndex: endDisplayIndex, columnId: String(column.field) },
  }
}

/** 判断当前业务行是否启用指定横向列合并规则。 */
function isColumnMergeActive<Row extends DataGridRow>(
  resolver: DataGridMergeResolver<Row>,
  column: DataGridColumn<Row>,
  config: DataGridColumnMergeConfig<Row>,
  row: Row,
  displayIndex: number,
) {
  if (!config.when) {
    return true
  }
  const context: DataGridCellMergeContext<Row> = {
    row,
    dataIndex: resolver.getDataIndex(row),
    displayIndex,
    field: column.field,
    value: getFieldValue(row, column.field),
  }
  return config.when(context)
}

/** 返回当前布局中有效的横向列合并区域。 */
function resolveColumnMergeRange<Row extends DataGridRow>(
  resolver: DataGridMergeResolver<Row>,
  column: DataGridColumn<Row>,
  row: Row,
  displayIndex: number,
): DataGridMergeRange | undefined {
  const config = column.columnMerge
  const api = resolver.getApi()
  if (
    !config ||
    !api ||
    config.fields.length < 2 ||
    !isColumnMergeActive(resolver, column, config, row, displayIndex)
  ) {
    return
  }

  const displayedColumns = api.getAllDisplayedColumns()
  const anchorIndex = displayedColumns.findIndex((item) => item.getColId() === String(column.field))
  if (anchorIndex < 0) {
    return
  }
  const actualColumns = displayedColumns.slice(anchorIndex, anchorIndex + config.fields.length)
  const expectedFields = config.fields.map(String)
  const hasExpectedLayout =
    actualColumns.length === expectedFields.length &&
    actualColumns.every((item, index) => item.getColId() === expectedFields[index]) &&
    actualColumns.every((item) => item.getPinned() === actualColumns[0]?.getPinned())
  if (!hasExpectedLayout) {
    return
  }

  return {
    kind: 'column',
    start: { displayIndex, columnId: expectedFields[0] },
    end: { displayIndex, columnId: expectedFields[expectedFields.length - 1] },
  }
}

/** 创建当前 DataGrid 实例使用的单元格合并解析器。 */
export function createDataGridMergeResolver<Row extends DataGridRow>(
  resolver: DataGridMergeResolver<Row>,
) {
  /** 返回指定单元格所属的行合并或列合并区域。 */
  function getCellMergeRange(displayIndex: number, field: string): DataGridMergeRange | undefined {
    const api = resolver.getApi()
    const row = api?.getDisplayedRowAtIndex(displayIndex)?.data
    const column = resolver.getColumns().find((item) => String(item.field) === field)
    if (!api || !row || !column) {
      return
    }

    const rowRange = resolveRowMergeRange(resolver, column, displayIndex)
    if (rowRange && rowRange.start.displayIndex !== rowRange.end.displayIndex) {
      return rowRange
    }

    for (const anchorColumn of resolver.getColumns()) {
      if (
        !anchorColumn.columnMerge ||
        !anchorColumn.columnMerge.fields.map(String).includes(field)
      ) {
        continue
      }
      const columnRange = resolveColumnMergeRange(resolver, anchorColumn, row, displayIndex)
      if (columnRange) {
        return columnRange
      }
    }
  }

  /** 返回 AG Grid 当前单元格需要纵向覆盖的展示行数。 */
  function getRowSpan(displayIndex: number, field: string) {
    const range = getCellMergeRange(displayIndex, field)
    if (!range || range.kind !== 'row' || range.start.displayIndex !== displayIndex) {
      return 1
    }
    return range.end.displayIndex - range.start.displayIndex + 1
  }

  /** 返回 AG Grid 当前单元格需要横向覆盖的展示列数。 */
  function getColumnSpan(displayIndex: number, field: string) {
    const range = getCellMergeRange(displayIndex, field)
    if (!range || range.kind !== 'column' || range.start.columnId !== field) {
      return 1
    }
    const displayedColumns = resolver.getApi()?.getAllDisplayedColumns() ?? []
    const startIndex = displayedColumns.findIndex(
      (column) => column.getColId() === range.start.columnId,
    )
    const endIndex = displayedColumns.findIndex(
      (column) => column.getColId() === range.end.columnId,
    )
    return startIndex >= 0 && endIndex >= startIndex ? endIndex - startIndex + 1 : 1
  }

  /** 判断指定逻辑单元格是否属于实际生效的合并区域。 */
  function isCellMerged(displayIndex: number, field: string) {
    return Boolean(getCellMergeRange(displayIndex, field))
  }

  /** 判断指定逻辑单元格是否被横向合并区域的锚点单元格覆盖。 */
  function isCoveredByColumnMerge(displayIndex: number, field: string) {
    const range = getCellMergeRange(displayIndex, field)
    return Boolean(range?.kind === 'column' && range.start.columnId !== field)
  }

  /** 展开指定合并区域中的全部逻辑单元格坐标。 */
  function getMergePoints(range: DataGridMergeRange) {
    if (range.kind === 'row') {
      return Array.from(
        { length: range.end.displayIndex - range.start.displayIndex + 1 },
        (_, index) => ({
          displayIndex: range.start.displayIndex + index,
          columnId: range.start.columnId,
        }),
      )
    }
    const displayedColumns = resolver.getApi()?.getAllDisplayedColumns() ?? []
    const startIndex = displayedColumns.findIndex(
      (column) => column.getColId() === range.start.columnId,
    )
    const endIndex = displayedColumns.findIndex(
      (column) => column.getColId() === range.end.columnId,
    )
    return displayedColumns.slice(startIndex, endIndex + 1).map((column) => ({
      displayIndex: range.start.displayIndex,
      columnId: column.getColId(),
    }))
  }

  return {
    getCellMergeRange,
    getRowSpan,
    getColumnSpan,
    isCellMerged,
    isCoveredByColumnMerge,
    getMergePoints,
  }
}

/** 从 DataGrid 列配置中提取当前行合并使用的字段。 */
export function getDataGridRowMergeFields<Row extends DataGridRow>(
  column: DataGridColumn<Row>,
): DataGridField<Row>[] {
  const config = column.rowMerge
  return config && config !== true && config.by?.length ? config.by : [column.field]
}
