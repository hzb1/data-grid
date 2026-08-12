import { describe, expect, it } from 'vitest'
import { useDataGridHistory } from './useDataGridHistory'

describe('DataGrid history transactions', () => {
  it('moves a complete transaction between undo and redo stacks', () => {
    const states: Array<{ undoSize: number; redoSize: number }> = []
    const history = useDataGridHistory(
      () => 10,
      (state) => states.push({ undoSize: state.undoSize, redoSize: state.redoSize }),
    )
    const entry = {
      source: 'edit' as const,
      changes: [
        {
          rowKey: 1,
          dataIndex: 0,
          field: 'quantity',
          oldValue: 1,
          newValue: 2,
          row: { id: 1, quantity: 2 },
        },
      ],
    }

    history.push(entry)
    expect(history.takeUndo()).toBe(entry)
    expect(history.takeRedo()).toBe(entry)
    expect(states).toEqual([
      { undoSize: 1, redoSize: 0 },
      { undoSize: 0, redoSize: 1 },
      { undoSize: 1, redoSize: 0 },
    ])
  })

  it('keeps only the configured number of complete transactions', () => {
    const history = useDataGridHistory(
      () => 2,
      () => undefined,
    )
    for (let index = 1; index <= 3; index += 1) {
      history.push({
        source: 'edit',
        changes: [
          {
            rowKey: index,
            dataIndex: index - 1,
            field: 'value',
            oldValue: index - 1,
            newValue: index,
            row: { id: index, value: index },
          },
        ],
      })
    }

    const latest = history.takeUndo()
    const previous = history.takeUndo()
    expect(latest?.source === 'edit' ? latest.changes[0].rowKey : undefined).toBe(3)
    expect(previous?.source === 'edit' ? previous.changes[0].rowKey : undefined).toBe(2)
    expect(history.takeUndo()).toBeUndefined()
  })
})
