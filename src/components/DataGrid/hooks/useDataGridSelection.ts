/**
 * 组合函数名称：DataGrid 单元格选区
 * 使用场景：维护排序、筛选后的展示坐标选区，并向组件层提供矩形选择能力。
 */

import type {
  CellFocusedEvent,
  CellKeyDownEvent,
  CellMouseDownEvent,
  CellMouseOverEvent,
  Column,
  GridApi,
} from 'ag-grid-community'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { DataGridMergeRange } from '../merge'
import type { DataGridRow, DataGridSelectionRange } from '../types'

/** DataGrid 内部单元格选区使用的展示坐标。 */
export type DataGridSelectionPoint = {
  /** 当前单元格在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前展示列标识。 */
  columnId: string
}

/** DataGrid 当前矩形选区解析后的边界。 */
export interface DataGridSelectionBounds {
  /** 选区顶部的视图位置。 */
  startDisplayIndex: number

  /** 选区底部的视图位置。 */
  endDisplayIndex: number

  /** 选区左侧业务列索引。 */
  startColumnIndex: number

  /** 选区右侧业务列索引。 */
  endColumnIndex: number

  /** 当前全部可参与矩形选择的展示列。 */
  columns: Column[]
}

/**
 * 管理 DataGrid 的单矩形区域选择。
 * 只维护显示行与显示列坐标，不读取或修改业务行数据。
 */
export function useDataGridSelection<Row extends DataGridRow>(
  getApi: () => GridApi<Row> | undefined,
  isEnabled: () => boolean,
  onChange: (range?: DataGridSelectionRange) => void,
  isSelectableColumn: (columnId: string) => boolean = () => true,
  getCellMergeRange: (point: DataGridSelectionPoint) => DataGridMergeRange | undefined = () =>
    undefined,
) {
  const anchor = ref<DataGridSelectionPoint>()
  const focus = ref<DataGridSelectionPoint>()
  const dragging = ref(false)

  function toPublicRange(): DataGridSelectionRange | undefined {
    if (!anchor.value || !focus.value) {
      return
    }
    return {
      start: { displayIndex: anchor.value.displayIndex, field: anchor.value.columnId },
      end: { displayIndex: focus.value.displayIndex, field: focus.value.columnId },
    }
  }

  function notify() {
    onChange(toPublicRange())
  }

  function resolveFocusPoint(point: DataGridSelectionPoint, range: DataGridMergeRange) {
    if (!anchor.value) {
      return range.end
    }
    const columns =
      getApi()
        ?.getAllDisplayedColumns()
        .filter((column) => isSelectableColumn(column.getColId())) ?? []
    const anchorColumnIndex = columns.findIndex(
      (column) => column.getColId() === anchor.value?.columnId,
    )
    const pointColumnIndex = columns.findIndex((column) => column.getColId() === point.columnId)
    return {
      displayIndex:
        point.displayIndex < anchor.value.displayIndex
          ? range.start.displayIndex
          : range.end.displayIndex,
      columnId: pointColumnIndex < anchorColumnIndex ? range.start.columnId : range.end.columnId,
    }
  }

  function select(point: DataGridSelectionPoint, extend = false) {
    const mergeRange = getCellMergeRange(point)
    if (!extend || !anchor.value) {
      anchor.value = mergeRange?.start ?? point
      focus.value = mergeRange?.end ?? point
    } else {
      focus.value = mergeRange ? resolveFocusPoint(point, mergeRange) : point
    }
    notify()
  }

  function selectRange(start: DataGridSelectionPoint, end: DataGridSelectionPoint) {
    const startRange = getCellMergeRange(start)
    anchor.value = startRange?.start ?? start
    const endRange = getCellMergeRange(end)
    focus.value = endRange ? resolveFocusPoint(end, endRange) : end
    notify()
  }

  function clear() {
    if (!anchor.value && !focus.value) {
      return
    }
    anchor.value = undefined
    focus.value = undefined
    dragging.value = false
    notify()
  }

  function onCellMouseDown(event: CellMouseDownEvent<Row>) {
    if (
      !isEnabled() ||
      event.rowIndex === null ||
      event.rowPinned ||
      !isSelectableColumn(event.column.getColId())
    ) {
      return
    }
    const mouseEvent = event.event as MouseEvent | undefined
    if (mouseEvent && mouseEvent.button !== 0) {
      return
    }
    select(
      { displayIndex: event.rowIndex, columnId: event.column.getColId() },
      Boolean(mouseEvent?.shiftKey),
    )
    dragging.value = true
  }

  function onCellMouseOver(event: CellMouseOverEvent<Row>) {
    if (
      !dragging.value ||
      event.rowIndex === null ||
      event.rowPinned ||
      !isSelectableColumn(event.column.getColId())
    ) {
      return
    }
    const point = {
      displayIndex: event.rowIndex,
      columnId: event.column.getColId(),
    }
    const mergeRange = getCellMergeRange(point)
    focus.value = mergeRange ? resolveFocusPoint(point, mergeRange) : point
    notify()
  }

  function onCellFocused(event: CellFocusedEvent<Row>) {
    if (!isEnabled() || event.rowIndex === null || !event.column || event.rowPinned) {
      return
    }
    const columnId = typeof event.column === 'string' ? event.column : event.column.getColId()
    if (!isSelectableColumn(columnId)) {
      return
    }
    if (!anchor.value) {
      select({ displayIndex: event.rowIndex, columnId })
    }
  }

  function onCellKeyDown(event: CellKeyDownEvent<Row>) {
    const keyboardEvent = event.event as KeyboardEvent | undefined
    if (!isEnabled() || !keyboardEvent?.shiftKey || event.rowIndex === null) {
      return
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(keyboardEvent.key)) {
      return
    }
    const api = getApi()
    if (!api) {
      return
    }
    const columns = api
      .getAllDisplayedColumns()
      .filter((column) => isSelectableColumn(column.getColId()))
    const columnIndex = columns.findIndex((column) => column.getColId() === event.column.getColId())
    let nextDisplayIndex = event.rowIndex
    let nextColumnIndex = columnIndex
    if (keyboardEvent.key === 'ArrowUp') nextDisplayIndex -= 1
    if (keyboardEvent.key === 'ArrowDown') nextDisplayIndex += 1
    if (keyboardEvent.key === 'ArrowLeft') nextColumnIndex -= 1
    if (keyboardEvent.key === 'ArrowRight') nextColumnIndex += 1
    nextDisplayIndex = Math.max(0, Math.min(api.getDisplayedRowCount() - 1, nextDisplayIndex))
    nextColumnIndex = Math.max(0, Math.min(columns.length - 1, nextColumnIndex))
    const nextColumn = columns[nextColumnIndex]
    if (!nextColumn) {
      return
    }
    keyboardEvent.preventDefault()
    api.setFocusedCell(nextDisplayIndex, nextColumn)
    api.ensureIndexVisible(nextDisplayIndex)
    api.ensureColumnVisible(nextColumn)
    select({ displayIndex: nextDisplayIndex, columnId: nextColumn.getColId() }, true)
  }

  function getBounds(): DataGridSelectionBounds | undefined {
    const api = getApi()
    if (!api || !anchor.value || !focus.value) {
      return
    }
    const columns = api
      .getAllDisplayedColumns()
      .filter((column) => isSelectableColumn(column.getColId()))
    const startColumnIndex = columns.findIndex(
      (column) => column.getColId() === anchor.value?.columnId,
    )
    const endColumnIndex = columns.findIndex(
      (column) => column.getColId() === focus.value?.columnId,
    )
    if (startColumnIndex < 0 || endColumnIndex < 0) {
      return
    }
    return {
      startDisplayIndex: Math.min(anchor.value.displayIndex, focus.value.displayIndex),
      endDisplayIndex: Math.max(anchor.value.displayIndex, focus.value.displayIndex),
      startColumnIndex: Math.min(startColumnIndex, endColumnIndex),
      endColumnIndex: Math.max(startColumnIndex, endColumnIndex),
      columns,
    }
  }

  function contains(displayIndex: number, columnId: string) {
    const bounds = getBounds()
    if (
      !bounds ||
      displayIndex < bounds.startDisplayIndex ||
      displayIndex > bounds.endDisplayIndex
    ) {
      return false
    }
    const columnIndex = bounds.columns.findIndex((column) => column.getColId() === columnId)
    return columnIndex >= bounds.startColumnIndex && columnIndex <= bounds.endColumnIndex
  }

  function getCellSelectionState(displayIndex: number, columnId: string) {
    const bounds = getBounds()
    if (
      !bounds ||
      displayIndex < bounds.startDisplayIndex ||
      displayIndex > bounds.endDisplayIndex
    ) {
      return
    }
    const columnIndex = bounds.columns.findIndex((column) => column.getColId() === columnId)
    if (columnIndex < bounds.startColumnIndex || columnIndex > bounds.endColumnIndex) {
      return
    }
    return {
      top: displayIndex === bounds.startDisplayIndex,
      right: columnIndex === bounds.endColumnIndex,
      bottom: displayIndex === bounds.endDisplayIndex,
      left: columnIndex === bounds.startColumnIndex,
    }
  }

  function stopDragging() {
    dragging.value = false
  }

  onMounted(() => document.addEventListener('mouseup', stopDragging))
  onBeforeUnmount(() => document.removeEventListener('mouseup', stopDragging))

  return {
    onCellMouseDown,
    onCellMouseOver,
    onCellFocused,
    onCellKeyDown,
    getBounds,
    contains,
    getCellSelectionState,
    clear,
    getRange: toPublicRange,
    select,
    selectRange,
  }
}
