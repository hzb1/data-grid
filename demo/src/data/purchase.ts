/** DataGrid 演示站采购明细数据与公共列选项。 */

import type { DataGridOption, DataGridRow } from '@data-grid/components/DataGrid/types'

/** 采购明细使用的业务行。 */
export interface PurchaseRow extends DataGridRow {
  /** 采购明细唯一标识。 */
  id: number

  /** 企业内部商品编码。 */
  sku: string

  /** 采购商品名称。 */
  productName: string

  /** 商品所属分类编码。 */
  category: string

  /** 供货商编码。 */
  supplier: string

  /** 本次采购数量。 */
  quantity: number

  /** 商品未税单价，单位为元。 */
  unitPrice: number

  /** 数量与单价计算得到的未税金额，单位为元。 */
  amount: number

  /** 计划交付日期，格式为 YYYY-MM-DD。 */
  deliveryDate: string

  /** 当前明细是否需要加急处理。 */
  urgent: boolean

  /** 采购人员补充的业务备注。 */
  note: string
}

/** 采购明细商品分类选项。 */
export const categoryOptions: DataGridOption<string>[] = [
  { label: '办公设备', value: 'equipment' },
  { label: '办公耗材', value: 'supplies' },
  { label: '网络设备', value: 'network' },
]

/** 采购明细供应商选项。 */
export const supplierOptions: DataGridOption<string>[] = [
  { label: '明光科技', value: 'mingguang' },
  { label: '远山办公', value: 'yuanshan' },
  { label: '海川数码', value: 'haichuan' },
]

const initialPurchaseRows: PurchaseRow[] = [
  {
    id: 1001,
    sku: 'OF-2401',
    productName: '人体工学办公椅',
    category: 'equipment',
    supplier: 'yuanshan',
    quantity: 12,
    unitPrice: 1280,
    amount: 15360,
    deliveryDate: '2026-08-18',
    urgent: false,
    note: '总部会议区更新',
  },
  {
    id: 1002,
    sku: 'IT-9032',
    productName: '27 英寸显示器',
    category: 'equipment',
    supplier: 'haichuan',
    quantity: 8,
    unitPrice: 1699,
    amount: 13592,
    deliveryDate: '2026-08-16',
    urgent: true,
    note: '研发新员工设备',
  },
  {
    id: 1003,
    sku: 'NW-1108',
    productName: '企业级无线接入点',
    category: 'network',
    supplier: 'mingguang',
    quantity: 6,
    unitPrice: 2380,
    amount: 14280,
    deliveryDate: '2026-08-22',
    urgent: false,
    note: '三层办公区扩容',
  },
  {
    id: 1004,
    sku: 'OF-0236',
    productName: 'A4 复印纸',
    category: 'supplies',
    supplier: 'yuanshan',
    quantity: 50,
    unitPrice: 27.8,
    amount: 1390,
    deliveryDate: '2026-08-14',
    urgent: true,
    note: '月底盘点前补充库存',
  },
  {
    id: 1005,
    sku: 'IT-5510',
    productName: 'USB-C 扩展坞',
    category: 'equipment',
    supplier: 'haichuan',
    quantity: 18,
    unitPrice: 469,
    amount: 8442,
    deliveryDate: '2026-08-25',
    urgent: false,
    note: '移动办公套装',
  },
  {
    id: 1006,
    sku: 'NW-4820',
    productName: '千兆交换机',
    category: 'network',
    supplier: 'mingguang',
    quantity: 4,
    unitPrice: 3250,
    amount: 13000,
    deliveryDate: '2026-08-28',
    urgent: false,
    note: '机房备件',
  },
]

/** 返回一份可安全编辑的采购明细初始数据。 */
export function createPurchaseRows() {
  return initialPurchaseRows.map((row) => ({ ...row }))
}
