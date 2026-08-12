import { describe, expectTypeOf, it } from 'vitest'
import type { DataGridCellSlot, DataGridSlots } from './types'

/** DataGrid 泛型插槽类型测试使用的严格业务行。 */
interface SlotTestRow {
  /** 测试行唯一标识。 */
  id: number

  /** 测试名称。 */
  name: string

  /** 测试数量。 */
  quantity: number
}

describe('DataGrid generic slots', () => {
  it('maps each business field to a typed dynamic cell slot', () => {
    type NameSlot = NonNullable<DataGridSlots<SlotTestRow>['cell-name']>
    type QuantitySlot = NonNullable<DataGridSlots<SlotTestRow>['cell-quantity']>

    expectTypeOf<Parameters<NameSlot>[0]>().toEqualTypeOf<DataGridCellSlot<SlotTestRow, 'name'>>()
    expectTypeOf<Parameters<QuantitySlot>[0]['row']>().toEqualTypeOf<SlotTestRow>()
    expectTypeOf<Parameters<QuantitySlot>[0]['value']>().toEqualTypeOf<number>()
    expectTypeOf<Parameters<QuantitySlot>[0]['column']['field']>().toEqualTypeOf<'quantity'>()
  })
})
