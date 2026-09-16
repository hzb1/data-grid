/** DataGrid 演示站场景注册表，统一提供长页目录、异步组件、代码和独立预览数据。 */

import { defineAsyncComponent } from 'vue'
import BasicDemo from '@demo/demos/BasicDemo.vue'
import basicSource from '@demo/demos/BasicDemo.vue?raw'
import complexSource from '@demo/demos/ComplexDemo.vue?raw'
import type { DemoDefinition, DemoId, DemoNavGroup } from './demo.types'

const ComplexDemo = defineAsyncComponent(() => import('@demo/demos/ComplexDemo.vue'))

const purchaseModelSource = String.raw`interface PurchaseRow extends DataGridRow {
  id: number
  sku: string
  productName: string
  category: string
  supplier: string
  quantity: number
  unitPrice: number
  amount: number
  deliveryDate: string
  urgent: boolean
  note: string
}`

const complexOrderModelSource = String.raw`interface ComplexOrderRow extends DataGridRow {
  id: number
  orderNo: string
  lineNo: number
  status: 'draft' | 'confirmed' | 'delivering' | 'completed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  businessUnit: string
  projectName: string
  customerName: string
  productCode: string
  productName: string
  category: string
  supplier: string
  region: string
  salesOwner: string
  orderedQuantity: number
  shippedQuantity: number
  unitPrice: number
  discountRate: number
  taxRate: number
  untaxedAmount: number
  taxedAmount: number
  plannedDeliveryDate: string
  actualDeliveryDate: string
  urgent: boolean
  note: string
}`

/** 将演示站内部源码引用转换为包使用者可复制的公开入口。 */
function toPublicSource(source: string) {
  return source
    .replace(
      "import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'",
      "import { DataGrid } from '@hzb-ui/data-grid'",
    )
    .replaceAll("'@data-grid/components/DataGrid/types'", "'@hzb-ui/data-grid'")
    .replaceAll("'@demo/data/purchase'", "'./purchase'")
    .replaceAll("'@demo/data/complex-order'", "'./complex-order'")
}

/** 所有演示场景的唯一注册入口。 */
export const demoRegistry: DemoDefinition[] = [
  {
    id: 'basic',
    title: '基础表格',
    navLabel: '基础表格',
    level: '入门',
    description: '从列配置开始，获得稳定行标识、固定列、格式化、排序与汇总。',
    hint: '点击任意表头排序，或拖动表头边缘调整列宽。',
    apiNames: ['columns', 'fixed', 'formatter', 'summary'],
    keywords: ['固定列', '排序', '格式化', '汇总'],
    component: BasicDemo,
    minHeight: 560,
    eager: true,
    codeTabs: [
      { id: 'complete', label: '完整示例', language: 'vue', source: toPublicSource(basicSource) },
      {
        id: 'config',
        label: '核心配置',
        language: 'typescript',
        source: String.raw`const columns: DataGridColumn<PurchaseRow>[] = [
  { field: 'sku', title: '商品编码', fixed: 'left', width: 128 },
  { field: 'productName', title: '商品名称', minWidth: 190, flex: 1 },
  { field: 'quantity', title: '数量', width: 92, align: 'right' },
  {
    field: 'amount',
    title: '金额',
    formatter: (value) => '¥' + Number(value).toLocaleString('zh-CN'),
    summary: { method: 'sum' },
  },
]`,
      },
      { id: 'model', label: '数据结构', language: 'typescript', source: purchaseModelSource },
    ],
  },
  {
    id: 'complex',
    title: '复杂订单明细表格',
    navLabel: '复杂表格',
    level: '业务',
    description:
      '用 1,000 条本地订单明细验证高密度、多表头业务场景，并集中体验筛选、编辑、校验、汇总与列配置。',
    hint: '筛选状态后全选结果，双击任意可编辑单元格修改数据，再试试右上角的表格配置。',
    apiNames: [
      'searchType',
      'rowSelection',
      'processRowChange',
      'validation',
      'columnSetting',
      'clipboard',
    ],
    keywords: ['1,000 行', '多表头', '筛选', '编辑', '校验', '列配置', '复制粘贴'],
    component: ComplexDemo,
    minHeight: 720,
    eager: false,
    codeTabs: [
      {
        id: 'complete',
        label: '完整示例',
        language: 'vue',
        source: toPublicSource(complexSource),
      },
      {
        id: 'config',
        label: '核心配置',
        language: 'typescript',
        source: String.raw`<DataGrid
  v-model="rows"
  v-model:selected-row-keys="selectedRowKeys"
  :columns="columns"
  row-key="id"
  mode="edit"
  editor-display-mode="onDemand"
  :row-selection="{ mode: 'multiple', selectAll: 'filtered' }"
  :clipboard="{ copyHeaders: true, repeatToSelection: true }"
  :column-setting="{
    key: 'demo-complex-order-grid',
    description: '复杂订单明细演示表格',
    minVisibleCount: 6,
  }"
  :summary="{ label: '当前筛选合计', scope: 'filtered' }"
  :process-row-change="recalculateAmounts"
  :validation="{ center: true, scrollToFirstError: true }"
/>`,
      },
      { id: 'model', label: '数据结构', language: 'typescript', source: complexOrderModelSource },
    ],
  },
]

/** 由场景注册表生成的页面目录，新增场景时无需再手工维护导航。 */
export const demoNavGroups: DemoNavGroup[] = [
  {
    label: '开始',
    items: [
      { id: 'when-to-use', label: '何时使用' },
      { id: 'quick-start', label: '快速开始' },
    ],
  },
  {
    label: '代码演示',
    items: demoRegistry.map((demo) => ({ id: demo.id, label: demo.navLabel })),
  },
]

/** 根据 URL 中的稳定标识查找演示场景。 */
export function findDemoById(id: string | null) {
  return demoRegistry.find((demo) => demo.id === id)
}

/** 生成可分享的独立演示页相对地址。 */
export function getDemoPreviewHref(id: DemoId) {
  return `./preview.html?demo=${encodeURIComponent(id)}`
}
