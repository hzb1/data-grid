import type { ColDef, GridApi } from 'ag-grid-community'
import { describe, expect, it, vi } from 'vitest'
import type { DataGridRow } from '../types'
import { useDataGridRowDrag } from './useDataGridRowDrag'

/** DataGrid 行拖动性能测试使用的业务行。 */
interface DataGridRowDragTestRow extends DataGridRow {
  /** 当前测试行的唯一标识。 */
  id: number
}

/** 行拖动列回调测试需要的精简参数。 */
interface DataGridRowDragCallbackParams {
  /** 当前渲染拖动手柄的业务行。 */
  data: DataGridRowDragTestRow

  /** 当前 AG Grid 行节点的固定行状态。 */
  node: {
    /** 当前行是否为固定行。 */
    rowPinned: boolean
  }
}

describe('useDataGridRowDrag', () => {
  it('checks a rendered drag handle without scanning all controlled rows', () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({ id: index + 1 }))
    const getRows = vi.fn(() => rows)
    const getRowIdentity = vi.fn((row: DataGridRowDragTestRow) => row.id)
    const findDataIndex = vi.fn(() => 5_000)
    const canReorder = vi.fn(() => true)
    const api = {
      isAnyFilterPresent: () => false,
      getColumnState: () => [],
    } as unknown as GridApi<DataGridRowDragTestRow>
    const rowDrag = useDataGridRowDrag<DataGridRowDragTestRow>({
      getApi: () => api,
      getRows,
      getConfig: () => ({}),
      getRowIdentity,
      findDataIndex,
      canReorder,
      onCommit: vi.fn(),
    })
    const column = rowDrag.createColumnDef() as ColDef<DataGridRowDragTestRow>
    const resolveRowDrag = column.rowDrag as unknown as (
      params: DataGridRowDragCallbackParams,
    ) => boolean

    expect(column.cellClass).toBe('data-grid__row-drag-cell')
    expect(column.headerClass).toBe('data-grid__row-drag-header')
    expect(resolveRowDrag({ data: rows[5_000], node: { rowPinned: false } })).toBe(true)
    expect(findDataIndex).toHaveBeenCalledOnce()
    expect(canReorder).toHaveBeenCalledOnce()
    expect(getRows).not.toHaveBeenCalled()
    expect(getRowIdentity).not.toHaveBeenCalled()
  })
})
