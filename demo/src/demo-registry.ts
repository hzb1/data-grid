/** DataGrid 演示站场景注册表，统一提供长页目录、异步组件、代码和独立预览数据。 */

import { defineAsyncComponent } from 'vue'
import BasicDemo from '@demo/demos/BasicDemo.vue'
import basicSource from '@demo/demos/BasicDemo.vue?raw'
import editValidationSource from '@demo/demos/EditValidationDemo.vue?raw'
import filterSelectionSource from '@demo/demos/FilterSelectionDemo.vue?raw'
import type { DemoDefinition, DemoId, DemoNavGroup } from './demo.types'

const FilterSelectionDemo = defineAsyncComponent(
  () => import('@demo/demos/FilterSelectionDemo.vue'),
)
const EditValidationDemo = defineAsyncComponent(() => import('@demo/demos/EditValidationDemo.vue'))

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

/** 将演示站内部源码引用转换为包使用者可复制的公开入口。 */
function toPublicSource(source: string) {
  return source
    .replace(
      "import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'",
      "import { DataGrid } from '@hzb-ui/data-grid'",
    )
    .replaceAll("'@data-grid/components/DataGrid/types'", "'@hzb-ui/data-grid'")
    .replaceAll("'@demo/data/purchase'", "'./purchase'")
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
    id: 'filter-selection',
    title: '筛选与选择',
    navLabel: '筛选与选择',
    level: '交互',
    description: '把不同字段映射成合适的表头筛选器，并让全选范围自动跟随筛选结果。',
    hint: '选择一个供应商，再点击表头复选框，只会选中当前筛选结果。',
    apiNames: ['searchType', 'rowSelection', 'selectedRowKeys', 'filter-change'],
    keywords: ['表头筛选', '行号', '多选', '受控选择'],
    component: FilterSelectionDemo,
    minHeight: 610,
    eager: false,
    codeTabs: [
      {
        id: 'complete',
        label: '完整示例',
        language: 'vue',
        source: toPublicSource(filterSelectionSource),
      },
      {
        id: 'config',
        label: '核心配置',
        language: 'typescript',
        source: String.raw`const supplierColumn: DataGridColumn<PurchaseRow> = {
  field: 'supplier',
  title: '供应商',
  options: supplierOptions,
  searchType: 'select',
  filter: { placeholder: '选择供应商' },
}

const rowSelection = {
  mode: 'multiple',
  selectOnRowClick: true,
  selectAll: 'filtered',
} as const`,
      },
      { id: 'model', label: '数据结构', language: 'typescript', source: purchaseModelSource },
    ],
  },
  {
    id: 'edit-validation',
    title: '编辑与业务校验',
    navLabel: '编辑与校验',
    level: '业务',
    description: '在单元格内完成数据录入，所有修改统一进入派生计算、校验和撤销历史。',
    hint: '把数量改成 0，或打开“加急”后清空备注，再点击校验全部数据。',
    apiNames: ['mode', 'editor', 'rules', 'processRowChange', 'validation'],
    keywords: ['单元格编辑', '自动计算', '字段校验', '跨字段校验'],
    component: EditValidationDemo,
    minHeight: 640,
    eager: false,
    codeTabs: [
      {
        id: 'complete',
        label: '完整示例',
        language: 'vue',
        source: toPublicSource(editValidationSource),
      },
      {
        id: 'config',
        label: '核心配置',
        language: 'typescript',
        source: String.raw`const quantityColumn: DataGridColumn<PurchaseRow> = {
  field: 'quantity',
  title: '数量',
  editor: { type: 'number', editable: true, componentProps: { min: 0 } },
  rules: [
    { validator: (value) => Number(value) > 0 || '采购数量必须大于 0' },
  ],
}

function recalculateAmount(row: PurchaseRow) {
  return { ...row, amount: Number((row.quantity * row.unitPrice).toFixed(2)) }
}`,
      },
      { id: 'model', label: '数据结构', language: 'typescript', source: purchaseModelSource },
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
