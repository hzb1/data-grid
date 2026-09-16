/** 复杂订单明细演示数据的稳定性与业务关系测试。 */

import { describe, expect, it } from 'vitest'
import { calculateComplexOrderAmounts, createComplexOrderRows } from './complex-order'

describe('复杂订单明细数据', () => {
  it('默认生成 1,000 条具有唯一标识的稳定数据', () => {
    const rows = createComplexOrderRows()

    expect(rows).toHaveLength(1_000)
    expect(new Set(rows.map((row) => row.id)).size).toBe(1_000)
    expect(rows[0]).toMatchObject({
      id: 300_001,
      orderNo: 'PO-2026-10001',
      lineNo: 1,
    })
  })

  it('生成数据的金额、发货量和交付日期均满足默认业务规则', () => {
    const rows = createComplexOrderRows()

    expect(
      rows.every((row) => {
        const amounts = calculateComplexOrderAmounts(
          row.orderedQuantity,
          row.unitPrice,
          row.discountRate,
          row.taxRate,
        )
        return (
          row.orderedQuantity > 0 &&
          row.shippedQuantity >= 0 &&
          row.shippedQuantity <= row.orderedQuantity &&
          row.untaxedAmount === amounts.untaxedAmount &&
          row.taxedAmount === amounts.taxedAmount &&
          (!row.actualDeliveryDate || row.actualDeliveryDate >= row.plannedDeliveryDate) &&
          (!row.urgent || Boolean(row.note.trim()))
        )
      }),
    ).toBe(true)
  })
})
