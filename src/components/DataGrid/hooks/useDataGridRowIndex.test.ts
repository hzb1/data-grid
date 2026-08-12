import type { GridApi } from 'ag-grid-community'
import { describe, expect, it, vi } from 'vitest'
import type { DataGridRow } from '../types'
import { DATA_GRID_ROW_INDEX_COLUMN_ID, useDataGridRowIndex } from './useDataGridRowIndex'

describe('DataGrid row index', () => {
  it('refreshes only the row index column without redrawing rendered rows', () => {
    const refreshCells = vi.fn()
    const redrawRows = vi.fn()
    const rowIndex = useDataGridRowIndex<DataGridRow>({
      getApi: () => ({ refreshCells, redrawRows }) as unknown as GridApi<DataGridRow>,
      getConfig: () => true,
      reportDiagnostic: vi.fn(),
    })

    rowIndex.refresh()

    expect(refreshCells).toHaveBeenCalledWith({
      columns: [DATA_GRID_ROW_INDEX_COLUMN_ID],
      force: true,
    })
    expect(redrawRows).not.toHaveBeenCalled()
  })
})
