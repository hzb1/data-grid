import { describe, expect, it } from 'vitest'
import { useDataGridPersistentEdit } from './useDataGridPersistentEdit'

describe('DataGrid persistent edit drafts', () => {
  it('keeps drafts isolated by row and field and removes values restored to their source', () => {
    const manager = useDataGridPersistentEdit()

    manager.setValue(1, 'remark', '原值', '草稿一')
    manager.setValue(2, 'remark', '原值', '草稿二')

    expect(manager.getValue(1, 'remark', '原值')).toBe('草稿一')
    expect(manager.getValue(2, 'remark', '原值')).toBe('草稿二')
    expect(manager.getDrafts()).toHaveLength(2)

    manager.setValue(1, 'remark', '原值', '原值')

    expect(manager.getDraft(1, 'remark')).toBeUndefined()
    expect(manager.getDrafts()).toHaveLength(1)
  })

  it('prunes drafts that no longer belong to active rows or fields', () => {
    const manager = useDataGridPersistentEdit()

    manager.setValue(1, 'remark', '', '保留')
    manager.setValue(2, 'remark', '', '删除')
    manager.setValue(1, 'name', '', '删除字段')
    manager.prune((draft) => draft.rowKey === 1 && draft.field === 'remark')

    expect(manager.getDrafts()).toEqual([
      {
        rowKey: 1,
        field: 'remark',
        originalValue: '',
        value: '保留',
      },
    ])
  })

  it('preserves explicit nullish drafts used when a control is cleared', () => {
    const manager = useDataGridPersistentEdit()

    manager.setValue(1, 'quantity', 10, undefined)
    manager.setValue(1, 'status', 'draft', null)

    expect(manager.getValue(1, 'quantity', 10)).toBeUndefined()
    expect(manager.getValue(1, 'status', 'draft')).toBeNull()
  })
})
