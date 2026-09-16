import { describe, expect, it, vi } from 'vitest'
import { useDataGridRowSelection } from './useDataGridRowSelection'
import type { DataGridRow } from '../types'

/** 行选择缓存测试使用的最小业务行。 */
interface RowSelectionTestRow extends DataGridRow {
  /** 当前业务行的稳定标识。 */
  id: number
}

describe('DataGrid 行选择缓存', () => {
  it('批量判断可选行时复用当前受控数组的行索引', () => {
    const rows = Array.from({ length: 1_000 }, (_, index): RowSelectionTestRow => ({
      id: index + 1,
    }))
    const indexOf = vi.spyOn(rows, 'indexOf')
    const rowSelection = useDataGridRowSelection<RowSelectionTestRow>({
      getApi: () => undefined,
      getRows: () => rows,
      getConfig: () => ({ mode: 'multiple' }),
      getExternalKeys: () => [],
      getRowKey: (row) => row.id,
      isInternalRowKey: () => false,
      onChange: () => undefined,
    })
    const isRowSelectable = rowSelection.agRowSelection.value?.isRowSelectable

    expect(isRowSelectable).toBeTypeOf('function')
    rows.forEach((row) => {
      expect(isRowSelectable?.({ data: row, rowPinned: undefined } as never)).toBe(true)
    })
    expect(indexOf).not.toHaveBeenCalled()
  })
})
