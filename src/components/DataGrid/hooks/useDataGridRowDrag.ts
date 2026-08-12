/**
 * 组合函数名称：DataGrid 行拖动
 * 使用场景：管理 DataGrid 行拖动手柄、拖动前后顺序采集和受控数据提交。
 */

import type { ColDef, GridApi, RowDragEndEvent, RowDragEnterEvent } from 'ag-grid-community'
import { ref } from 'vue'
import type { DataGridRow, DataGridRowDragConfig, DataGridRowOrderChange } from '../types'

/** DataGrid 内部行拖动手柄列标识。 */
export const DATA_GRID_ROW_DRAG_COLUMN_ID = '__dataGridRowDrag'

/** DataGrid 行拖动组合函数参数。 */
interface UseDataGridRowDragOptions<Row extends DataGridRow> {
  /** 获取当前 AG Grid API。 */
  getApi: () => GridApi<Row> | undefined

  /** 获取当前受控行数据。 */
  getRows: () => Row[]

  /** 获取当前行拖动配置。 */
  getConfig: () => false | DataGridRowDragConfig<Row>

  /** 获取指定行的稳定唯一标识。 */
  getRowIdentity: (row: Row) => string | number

  /** 通过行对象 O(1) 定位其在当前受控数据中的下标。 */
  findDataIndex: (row: Row) => number

  /** 判断表格当前模式和行标识是否允许修改行顺序。 */
  canReorder: () => boolean

  /** 行顺序完成变化后提交受控数据。 */
  onCommit: (change: DataGridRowOrderChange<Row>, beforeRowKeys: Array<string | number>) => void
}

/** 判断两个行标识序列是否完全一致。 */
function isSameRowOrder(left: Array<string | number>, right: Array<string | number>) {
  return (
    left.length === right.length && left.every((rowKey, index) => Object.is(rowKey, right[index]))
  )
}

/**
 * 管理 DataGrid 的单行拖动。
 * AG Grid 会在拖动过程中持续调整内部行模型，结束后通过微任务读取最终顺序。
 */
export function useDataGridRowDrag<Row extends DataGridRow>(
  options: UseDataGridRowDragOptions<Row>,
) {
  const beforeRowKeys = ref<Array<string | number>>([])

  function getRowKeys(rows = options.getRows()) {
    return rows.map((row) => options.getRowIdentity(row))
  }

  function hasActiveSortOrFilter() {
    const api = options.getApi()
    return Boolean(
      api?.isAnyFilterPresent() || api?.getColumnState().some((column) => Boolean(column.sort)),
    )
  }

  function isEnabled() {
    return Boolean(options.getConfig() && options.canReorder() && !hasActiveSortOrFilter())
  }

  function canDragRow(row: Row, dataIndex: number) {
    const config = options.getConfig()
    if (!config || !isEnabled()) {
      return false
    }
    return config.canDrag ? config.canDrag({ row, dataIndex }) : true
  }

  function createColumnDef(): ColDef<Row> | undefined {
    const config = options.getConfig()
    if (!config) {
      return
    }
    const width = Math.max(36, config.handleWidth ?? 44)
    return {
      colId: DATA_GRID_ROW_DRAG_COLUMN_ID,
      headerName: '',
      headerTooltip: '拖动调整行顺序',
      width,
      minWidth: width,
      maxWidth: width,
      pinned: config.fixed ?? 'left',
      lockPinned: true,
      lockPosition: config.fixed ?? 'left',
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      suppressMovable: true,
      suppressNavigable: true,
      cellClass: 'data-grid__row-drag-cell',
      headerClass: 'data-grid__row-drag-header',
      rowDrag: (params) => {
        if (!params.data || params.node.rowPinned) {
          return false
        }
        const dataIndex = options.findDataIndex(params.data)
        return dataIndex >= 0 && canDragRow(params.data, dataIndex)
      },
      rowDragText: (params) => {
        const row = params.rowNode?.data as Row | undefined
        if (!row) {
          return '调整行顺序'
        }
        const dataIndex = options.findDataIndex(row)
        return config.dragText?.({ row, dataIndex }) ?? '调整行顺序'
      },
    }
  }

  function onRowDragEnter(event: RowDragEnterEvent<Row>) {
    if (!event.node.data || !isEnabled()) {
      beforeRowKeys.value = []
      return
    }
    beforeRowKeys.value = getRowKeys()
  }

  function onRowDragEnd(event: RowDragEndEvent<Row>) {
    const previousRowKeys = [...beforeRowKeys.value]
    const draggedRow = event.node.data
    beforeRowKeys.value = []
    if (!draggedRow || !previousRowKeys.length) {
      return
    }
    queueMicrotask(() => {
      const api = options.getApi()
      if (!api) {
        return
      }
      const rows: Row[] = []
      api.forEachNode((node) => {
        if (node.data && !node.rowPinned) {
          rows.push(node.data)
        }
      })
      const rowKeys = getRowKeys(rows)
      if (rows.length !== options.getRows().length || isSameRowOrder(previousRowKeys, rowKeys)) {
        return
      }
      const rowKey = options.getRowIdentity(draggedRow)
      const oldDataIndex = previousRowKeys.findIndex((key) => Object.is(key, rowKey))
      const newDataIndex = rowKeys.findIndex((key) => Object.is(key, rowKey))
      if (oldDataIndex < 0 || newDataIndex < 0) {
        return
      }
      options.onCommit(
        {
          row: draggedRow,
          rowKey,
          oldDataIndex,
          newDataIndex,
          rows,
        },
        previousRowKeys,
      )
    })
  }

  function refreshHandles() {
    const api = options.getApi()
    if (!api) {
      return
    }
    api.refreshCells({
      columns: [DATA_GRID_ROW_DRAG_COLUMN_ID],
      force: true,
    })
  }

  return {
    createColumnDef,
    isEnabled,
    onRowDragEnter,
    onRowDragEnd,
    refreshHandles,
  }
}
