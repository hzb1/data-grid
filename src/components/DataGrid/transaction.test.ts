import { describe, expect, it } from 'vitest'
import { applyDataGridRowTransaction } from './transaction'
import type { DataGridColumn, DataGridRowChangeContext } from './types'

/** 行事务测试使用的订单明细。 */
interface TransactionRow extends Record<string, unknown> {
  /** 当前明细唯一标识。 */
  id: number

  /** 当前明细状态值。 */
  status: string

  /** 当前明细状态名称。 */
  statusName: string

  /** 当前明细数量。 */
  quantity: number

  /** 当前明细单价。 */
  price: number

  /** 当前明细派生金额。 */
  amount: number
}

const columns: DataGridColumn<TransactionRow>[] = [
  {
    field: 'status',
    title: '状态',
    options: [
      { label: '草稿', value: 'draft' },
      { label: '完成', value: 'done' },
    ],
    optionMapping: { labelField: 'statusName' },
  },
  { field: 'quantity', title: '数量' },
  { field: 'price', title: '单价' },
  { field: 'amount', title: '金额' },
]

function processRowChange(row: TransactionRow, context: DataGridRowChangeContext<TransactionRow>) {
  return context.changedFields.some((field) => field === 'quantity' || field === 'price')
    ? { ...row, amount: row.quantity * row.price }
    : row
}

describe('DataGrid row transaction', () => {
  it('applies option mapping and derived fields without mutating source rows', () => {
    const sourceRows: TransactionRow[] = [
      { id: 1, status: 'draft', statusName: '草稿', quantity: 2, price: 10, amount: 20 },
    ]
    const result = applyDataGridRowTransaction(
      sourceRows,
      [
        { dataIndex: 0, field: 'status', newValue: 'done' },
        { dataIndex: 0, field: 'quantity', newValue: 3 },
      ],
      'edit',
      {
        columns,
        getRowKey: (row) => row.id,
        processRowChange,
      },
    )

    expect(result.errors).toEqual([])
    expect(result.rows).not.toBe(sourceRows)
    expect(result.rows[0]).toEqual({
      id: 1,
      status: 'done',
      statusName: '完成',
      quantity: 3,
      price: 10,
      amount: 30,
    })
    expect(sourceRows[0]).toEqual({
      id: 1,
      status: 'draft',
      statusName: '草稿',
      quantity: 2,
      price: 10,
      amount: 20,
    })
    expect(result.changes.map((change) => change.field)).toEqual([
      'status',
      'statusName',
      'quantity',
      'amount',
    ])
  })

  it('rolls back the complete batch when row processing throws', () => {
    const sourceRows: TransactionRow[] = [
      { id: 1, status: 'draft', statusName: '草稿', quantity: 1, price: 10, amount: 10 },
      { id: 2, status: 'draft', statusName: '草稿', quantity: 2, price: 10, amount: 20 },
    ]
    const result = applyDataGridRowTransaction(
      sourceRows,
      [
        { dataIndex: 0, field: 'quantity', newValue: 3 },
        { dataIndex: 1, field: 'quantity', newValue: -1, text: '-1', displayIndex: 6 },
      ],
      'paste',
      {
        columns,
        getRowKey: (row) => row.id,
        processRowChange: (row) => {
          if (row.quantity < 0) {
            throw new Error('数量不能小于零')
          }
          return { ...row, amount: row.quantity * row.price }
        },
      },
    )

    expect(result.rows).toBe(sourceRows)
    expect(result.changes).toEqual([])
    expect(result.errors).toMatchObject([
      {
        displayIndex: 6,
        field: 'quantity',
        text: '-1',
        message: '数量不能小于零',
        row: sourceRows[1],
      },
    ])
  })
})
