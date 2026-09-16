/** DataGrid 复杂订单明细演示使用的稳定模拟数据与选项。 */

import type { DataGridOption, DataGridRow } from '@data-grid/components/DataGrid/types'

/**
 * 订单执行状态。
 *
 * - `draft`：订单仍在草稿阶段。
 * - `confirmed`：订单已确认并等待执行。
 * - `delivering`：订单正在发货或运输中。
 * - `completed`：订单已完成交付。
 */
export type ComplexOrderStatus = 'draft' | 'confirmed' | 'delivering' | 'completed'

/**
 * 订单处理优先级。
 *
 * - `low`：低优先级，按常规节奏处理。
 * - `normal`：普通优先级。
 * - `high`：高优先级，需要优先安排。
 * - `urgent`：紧急优先级，需要立即跟进。
 */
export type ComplexOrderPriority = 'low' | 'normal' | 'high' | 'urgent'

/** 复杂订单明细表格中的单行业务数据。 */
export interface ComplexOrderRow extends DataGridRow {
  /** 订单明细的稳定唯一标识。 */
  id: number

  /** 采购订单编号。 */
  orderNo: string

  /** 当前订单中的明细行号。 */
  lineNo: number

  /** 当前订单明细的执行状态。 */
  status: ComplexOrderStatus

  /** 当前订单明细的处理优先级。 */
  priority: ComplexOrderPriority

  /** 负责执行订单的事业部。 */
  businessUnit: string

  /** 当前订单归属的项目名称。 */
  projectName: string

  /** 订单对应的客户名称。 */
  customerName: string

  /** 商品内部编码。 */
  productCode: string

  /** 商品展示名称。 */
  productName: string

  /** 商品分类编码。 */
  category: string

  /** 供货商编码。 */
  supplier: string

  /** 订单负责区域。 */
  region: string

  /** 订单销售负责人。 */
  salesOwner: string

  /** 当前订单的下单数量。 */
  orderedQuantity: number

  /** 当前订单已经发货的数量。 */
  shippedQuantity: number

  /** 商品未税单价，单位为元。 */
  unitPrice: number

  /** 商品折扣率，使用百分数存储。 */
  discountRate: number

  /** 商品税率，使用百分数存储。 */
  taxRate: number

  /** 按数量、单价和折扣计算的未税金额，单位为元。 */
  untaxedAmount: number

  /** 按未税金额和税率计算的含税金额，单位为元。 */
  taxedAmount: number

  /** 计划交付日期，格式为 YYYY-MM-DD。 */
  plannedDeliveryDate: string

  /** 实际交付日期；未完成交付时为空字符串。 */
  actualDeliveryDate: string

  /** 当前订单是否需要加急跟进。 */
  urgent: boolean

  /** 订单的补充业务备注。 */
  note: string
}

/** 订单执行状态选项。 */
export const complexOrderStatusOptions: DataGridOption<ComplexOrderStatus>[] = [
  { label: '草稿', value: 'draft' },
  { label: '已确认', value: 'confirmed' },
  { label: '运输中', value: 'delivering' },
  { label: '已完成', value: 'completed' },
]

/** 订单处理优先级选项。 */
export const complexOrderPriorityOptions: DataGridOption<ComplexOrderPriority>[] = [
  { label: '低', value: 'low' },
  { label: '普通', value: 'normal' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
]

/** 事业部选项。 */
export const complexBusinessUnitOptions: DataGridOption<string>[] = [
  { label: '企业服务事业部', value: 'enterprise' },
  { label: '智能制造事业部', value: 'manufacturing' },
  { label: '消费零售事业部', value: 'retail' },
  { label: '公共事务事业部', value: 'public' },
]

/** 商品分类选项。 */
export const complexCategoryOptions: DataGridOption<string>[] = [
  { label: '办公设备', value: 'equipment' },
  { label: '网络设备', value: 'network' },
  { label: '办公耗材', value: 'supplies' },
  { label: '协作软件', value: 'software' },
]

/** 供货商选项。 */
export const complexSupplierOptions: DataGridOption<string>[] = [
  { label: '明光科技', value: 'mingguang' },
  { label: '远山办公', value: 'yuanshan' },
  { label: '海川数码', value: 'haichuan' },
  { label: '北辰软件', value: 'beichen' },
]

/** 订单负责区域选项。 */
export const complexRegionOptions: DataGridOption<string>[] = [
  { label: '华东', value: 'east' },
  { label: '华南', value: 'south' },
  { label: '华北', value: 'north' },
  { label: '西南', value: 'southwest' },
]

const projectNames = ['总部办公升级', '园区网络扩容', '门店数字化改造', '生产线协同改造']
const customerNames = ['云帆集团', '星河零售', '远景制造', '开元公共服务']
const productNames = ['人体工学办公椅', '企业级无线接入点', '27 英寸显示器', '协同办公许可']
const salesOwners = ['陈晗', '李墨', '周宁', '王澈', '徐阳']
const unitPrices = [1280, 2380, 1699, 860]
const taxRates = [6, 9, 13]

/** 将选项值转换成对应的展示名称。 */
export function findComplexOptionLabel<Value>(value: Value, options: DataGridOption<Value>[]) {
  return options.find((option) => option.value === value)?.label ?? '—'
}

/** 根据订单可编辑字段计算未税和含税金额。 */
export function calculateComplexOrderAmounts(
  orderedQuantity: number,
  unitPrice: number,
  discountRate: number,
  taxRate: number,
) {
  const untaxedAmount = Number(
    (Number(orderedQuantity) * Number(unitPrice) * (1 - Number(discountRate) / 100)).toFixed(2),
  )
  const taxedAmount = Number((untaxedAmount * (1 + Number(taxRate) / 100)).toFixed(2))

  return { untaxedAmount, taxedAmount }
}

/** 将从 2026 年 1 月 1 日开始的偏移天数转换成标准日期字符串。 */
function createDate(offset: number) {
  const date = new Date(Date.UTC(2026, 0, 1 + offset))
  return date.toISOString().slice(0, 10)
}

/**
 * 创建复杂订单明细的本地演示数据。
 *
 * 默认生成 1,000 行，数据完全由行序号推导，便于稳定复现筛选、编辑与性能表现。
 */
export function createComplexOrderRows(count = 1_000) {
  return Array.from({ length: count }, (_, index): ComplexOrderRow => {
    const status = complexOrderStatusOptions[index % complexOrderStatusOptions.length]!.value
    const priority = complexOrderPriorityOptions[index % complexOrderPriorityOptions.length]!.value
    const businessUnit =
      complexBusinessUnitOptions[index % complexBusinessUnitOptions.length]!.value
    const category = complexCategoryOptions[index % complexCategoryOptions.length]!.value
    const supplier = complexSupplierOptions[index % complexSupplierOptions.length]!.value
    const region = complexRegionOptions[index % complexRegionOptions.length]!.value
    const orderedQuantity = 8 + (index % 120)
    const shippedQuantity =
      status === 'draft' || status === 'confirmed'
        ? 0
        : status === 'delivering'
          ? Math.floor(orderedQuantity * 0.6)
          : orderedQuantity
    const unitPrice = unitPrices[index % unitPrices.length]!
    const discountRate = [0, 3, 5, 8][index % 4]!
    const taxRate = taxRates[index % taxRates.length]!
    const plannedDeliveryDate = createDate(index + 14)
    const actualDeliveryDate = status === 'completed' ? createDate(index + 18) : ''
    const urgent = priority === 'urgent'
    const { untaxedAmount, taxedAmount } = calculateComplexOrderAmounts(
      orderedQuantity,
      unitPrice,
      discountRate,
      taxRate,
    )

    return {
      id: 300_001 + index,
      orderNo: `PO-2026-${String(10_001 + Math.floor(index / 8)).padStart(5, '0')}`,
      lineNo: (index % 8) + 1,
      status,
      priority,
      businessUnit,
      projectName: projectNames[index % projectNames.length]!,
      customerName: customerNames[index % customerNames.length]!,
      productCode: `SKU-${String(2_401 + (index % 240)).padStart(4, '0')}`,
      productName: productNames[index % productNames.length]!,
      category,
      supplier,
      region,
      salesOwner: salesOwners[index % salesOwners.length]!,
      orderedQuantity,
      shippedQuantity,
      unitPrice,
      discountRate,
      taxRate,
      untaxedAmount,
      taxedAmount,
      plannedDeliveryDate,
      actualDeliveryDate,
      urgent,
      note: urgent ? '需优先协调交付资源' : '',
    }
  })
}
