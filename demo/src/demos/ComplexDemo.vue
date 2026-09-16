<script setup lang="ts">
/**
 * 组件名称：复杂订单明细表格演示
 * 使用场景：用 1,000 条本地订单明细集中展示 DataGrid 的高密度展示、筛选、选择、编辑、校验、汇总和列配置能力。
 */

import { ref, shallowRef } from 'vue'
import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'
import type {
  DataGridColumn,
  DataGridFilterItem,
  DataGridRowKey,
  DataGridValidationState,
} from '@data-grid/components/DataGrid/types'
import {
  calculateComplexOrderAmounts,
  complexBusinessUnitOptions,
  complexCategoryOptions,
  complexOrderPriorityOptions,
  complexOrderStatusOptions,
  complexRegionOptions,
  complexSupplierOptions,
  createComplexOrderRows,
  findComplexOptionLabel,
  type ComplexOrderPriority,
  type ComplexOrderRow,
  type ComplexOrderStatus,
} from '@demo/data/complex-order'

// 业务行始终通过 DataGrid 的受控数组事务替换，浅响应式可避免为 1,000 条静态初始明细创建深层代理。
const rows = shallowRef(createComplexOrderRows())
const selectedRowKeys = ref<DataGridRowKey[]>([])
const activeFilters = ref<DataGridFilterItem<ComplexOrderRow>[]>([])
const validationErrorCount = ref(0)
const validationMessage = ref('尚未执行整表校验')

function formatCurrency(value: unknown) {
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPercentage(value: unknown) {
  return `${Number(value).toFixed(0)}%`
}

const columns: DataGridColumn<ComplexOrderRow>[] = [
  {
    field: 'orderNo',
    title: '订单号',
    fixed: 'left',
    width: 164,
    searchType: 'text',
    filter: { placeholder: '搜索订单号' },
  },
  {
    field: 'lineNo',
    title: '行号',
    fixed: 'left',
    width: 76,
    align: 'right',
    searchType: 'number',
    filter: { placeholder: '输入行号' },
  },
  {
    field: 'status',
    title: '执行状态',
    fixed: 'left',
    width: 116,
    options: complexOrderStatusOptions,
    searchType: 'multiSelect',
    filter: { placeholder: '选择状态' },
    editor: { type: 'select', editable: true, componentProps: { placeholder: '选择状态' } },
  },
  {
    field: 'priority',
    title: '优先级',
    width: 92,
    options: complexOrderPriorityOptions,
    formatter: (value) =>
      findComplexOptionLabel(value as ComplexOrderPriority, complexOrderPriorityOptions),
    searchType: 'select',
    filter: { placeholder: '选择优先级' },
    editor: { type: 'select', editable: true, componentProps: { placeholder: '选择优先级' } },
  },
  {
    field: 'businessUnit',
    title: '事业部',
    width: 156,
    options: complexBusinessUnitOptions,
    formatter: (value) => findComplexOptionLabel(value as string, complexBusinessUnitOptions),
    searchType: 'select',
    filter: { placeholder: '选择事业部' },
  },
  {
    field: 'projectName',
    title: '项目名称',
    width: 164,
    align: 'left',
    searchType: 'text',
    filter: { placeholder: '搜索项目' },
  },
  {
    field: 'customerName',
    title: '客户名称',
    width: 150,
    align: 'left',
    searchType: 'text',
    filter: { placeholder: '搜索客户' },
  },
  {
    field: 'productCode',
    title: '商品编码',
    width: 138,
    searchType: 'text',
    filter: { placeholder: '搜索编码' },
  },
  {
    field: 'productName',
    title: '商品名称',
    width: 176,
    align: 'left',
    searchType: 'text',
    filter: { placeholder: '搜索商品' },
  },
  {
    field: 'category',
    title: '商品分类',
    width: 126,
    options: complexCategoryOptions,
    formatter: (value) => findComplexOptionLabel(value as string, complexCategoryOptions),
    searchType: 'select',
    filter: { placeholder: '选择分类' },
  },
  {
    field: 'supplier',
    title: '供应商',
    width: 126,
    options: complexSupplierOptions,
    formatter: (value) => findComplexOptionLabel(value as string, complexSupplierOptions),
    searchType: 'select',
    filter: { placeholder: '选择供应商' },
  },
  {
    field: 'region',
    title: '负责区域',
    width: 108,
    options: complexRegionOptions,
    formatter: (value) => findComplexOptionLabel(value as string, complexRegionOptions),
    searchType: 'select',
    filter: { placeholder: '选择区域' },
  },
  {
    field: 'salesOwner',
    title: '销售负责人',
    width: 118,
    searchType: 'text',
    filter: { placeholder: '搜索负责人' },
  },
  {
    field: 'orderedQuantity',
    title: '下单数量',
    width: 116,
    align: 'right',
    searchType: 'numberRange',
    filter: { placeholder: '下单数量范围' },
    editor: { type: 'number', editable: true, componentProps: { min: 1, precision: 0 } },
    rules: [{ validator: (value) => Number(value) > 0 || '下单数量必须大于 0' }],
    summary: { method: 'sum' },
  },
  {
    field: 'shippedQuantity',
    title: '已发数量',
    width: 116,
    align: 'right',
    searchType: 'numberRange',
    filter: { placeholder: '已发数量范围' },
    editor: { type: 'number', editable: true, componentProps: { min: 0, precision: 0 } },
    rules: [{ validator: (value) => Number(value) >= 0 || '已发数量不能小于 0' }],
    summary: { method: 'sum' },
  },
  {
    field: 'unitPrice',
    title: '未税单价',
    width: 132,
    align: 'right',
    formatter: formatCurrency,
    searchType: 'numberRange',
    filter: { placeholder: '单价范围' },
    editor: { type: 'number', editable: true, componentProps: { min: 0.01, precision: 2 } },
    rules: [{ validator: (value) => Number(value) > 0 || '未税单价必须大于 0' }],
  },
  {
    field: 'discountRate',
    title: '折扣率',
    width: 104,
    align: 'right',
    formatter: formatPercentage,
    searchType: 'numberRange',
    filter: { placeholder: '折扣范围' },
    editor: { type: 'number', editable: true, componentProps: { min: 0, max: 100, precision: 0 } },
    rules: [
      {
        validator: (value) =>
          (Number(value) >= 0 && Number(value) <= 100) || '折扣率需在 0 到 100 之间',
      },
    ],
  },
  {
    field: 'taxRate',
    title: '税率',
    width: 92,
    align: 'right',
    formatter: formatPercentage,
    searchType: 'numberRange',
    filter: { placeholder: '税率范围' },
    editor: { type: 'number', editable: true, componentProps: { min: 0, max: 100, precision: 0 } },
    rules: [
      {
        validator: (value) =>
          (Number(value) >= 0 && Number(value) <= 100) || '税率需在 0 到 100 之间',
      },
    ],
  },
  {
    field: 'untaxedAmount',
    title: '未税金额',
    width: 138,
    align: 'right',
    formatter: formatCurrency,
    searchType: 'numberRange',
    filter: { placeholder: '金额范围' },
    editor: false,
    summary: { method: 'sum', formatter: (value) => formatCurrency(value) },
  },
  {
    field: 'taxedAmount',
    title: '含税金额',
    fixed: 'right',
    width: 138,
    align: 'right',
    formatter: formatCurrency,
    searchType: 'numberRange',
    filter: { placeholder: '金额范围' },
    editor: false,
    summary: { method: 'sum', formatter: (value) => formatCurrency(value) },
  },
  {
    field: 'plannedDeliveryDate',
    title: '计划交付',
    width: 142,
    searchType: 'dateRange',
    filter: { placeholder: '选择计划日期' },
    editor: {
      type: 'date',
      editable: true,
      componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '选择计划日期' },
    },
    rules: [{ required: true, message: '请选择计划交付日期' }],
  },
  {
    field: 'actualDeliveryDate',
    title: '实际交付',
    width: 142,
    searchType: 'dateRange',
    filter: { placeholder: '选择实际日期' },
    editor: {
      type: 'date',
      editable: true,
      componentProps: { valueFormat: 'YYYY-MM-DD', placeholder: '选择实际日期' },
    },
  },
  {
    field: 'urgent',
    title: '加急',
    width: 84,
    searchType: 'boolean',
    filter: { placeholder: '筛选加急' },
    editor: { type: 'boolean', editable: true },
  },
  {
    field: 'note',
    title: '备注',
    width: 188,
    align: 'left',
    searchType: 'text',
    filter: { placeholder: '搜索备注' },
    editor: { type: 'text', editable: true, componentProps: { placeholder: '加急订单需填写备注' } },
  },
]

function recalculateAmounts(row: ComplexOrderRow) {
  return {
    ...row,
    ...calculateComplexOrderAmounts(
      row.orderedQuantity,
      row.unitPrice,
      row.discountRate,
      row.taxRate,
    ),
  }
}

function onValidationChange(state: DataGridValidationState<ComplexOrderRow>) {
  validationErrorCount.value = state.errors.length
}

function getRowValidationErrorCount(row: ComplexOrderRow) {
  return [
    row.orderedQuantity > 0,
    row.shippedQuantity >= 0 && row.shippedQuantity <= row.orderedQuantity,
    row.unitPrice > 0,
    row.discountRate >= 0 && row.discountRate <= 100,
    row.taxRate >= 0 && row.taxRate <= 100,
    Boolean(row.plannedDeliveryDate),
    !row.actualDeliveryDate || row.actualDeliveryDate >= row.plannedDeliveryDate,
    !row.urgent || Boolean(row.note.trim()),
  ].filter((valid) => !valid).length
}

function validateAll() {
  const errorCount = rows.value.reduce((count, row) => count + getRowValidationErrorCount(row), 0)
  validationErrorCount.value = errorCount
  validationMessage.value = errorCount
    ? `1,000 条数据中发现 ${errorCount} 个问题`
    : '1,000 条数据校验通过，可以提交'
}
</script>

<template>
  <div class="complex-demo">
    <!-- DataGrid 高性能表格 -->
    <!-- @vue-generic {ComplexOrderRow} -->
    <DataGrid
      v-model="rows"
      v-model:selected-row-keys="selectedRowKeys"
      :columns="columns"
      row-key="id"
      mode="edit"
      editor-display-mode="onDemand"
      :height="560"
      :height-resize="{ min: 360, max: 820 }"
      :row-numbering="true"
      :row-selection="{ mode: 'multiple', selectOnRowClick: true, selectAll: 'filtered' }"
      :clipboard="{ copyHeaders: true, repeatToSelection: true }"
      :column-setting="{
        key: 'demo-complex-order-grid',
        description: '复杂订单明细演示表格',
        revision: 1,
        minVisibleCount: 6,
      }"
      :summary="{ label: '当前筛选合计', scope: 'filtered' }"
      :history="{ limit: 50 }"
      :process-row-change="recalculateAmounts"
      :row-rules="[
        {
          validator: (row) =>
            row.shippedQuantity <= row.orderedQuantity
              ? true
              : { field: 'shippedQuantity', message: '已发数量不能大于下单数量' },
        },
        {
          validator: (row) =>
            !row.actualDeliveryDate || row.actualDeliveryDate >= row.plannedDeliveryDate
              ? true
              : { field: 'actualDeliveryDate', message: '实际交付日期不能早于计划交付日期' },
        },
        {
          validator: (row) =>
            !row.urgent || row.note.trim()
              ? true
              : { field: 'note', message: '加急订单必须填写备注' },
        },
      ]"
      :validation="{ center: true, scrollToFirstError: true }"
      @filter-change="activeFilters = $event"
      @validation-change="onValidationChange"
    >
      <template #toolbar-left>
        <div class="complex-demo__toolbar" aria-live="polite">
          <span>本地 1,000 条订单明细</span>
          <span>{{ activeFilters.length }} 个筛选条件</span>
          <span>{{ selectedRowKeys.length }} 行已选择</span>
          <span>{{ validationErrorCount }} 个校验问题</span>
          <el-button size="small" @click="validateAll">校验全部数据</el-button>
          <small>{{ validationMessage }}</small>
        </div>
      </template>

      <template #cell-status="{ row }">
        <el-tag
          size="small"
          effect="plain"
          :class="`complex-demo__status complex-demo__status--${row.status}`"
        >
          {{ findComplexOptionLabel(row.status as ComplexOrderStatus, complexOrderStatusOptions) }}
        </el-tag>
      </template>

      <template #cell-urgent="{ row }">
        <el-tag v-if="row.urgent" size="small" type="danger" effect="light">加急</el-tag>
        <span v-else>—</span>
      </template>
    </DataGrid>
  </div>
</template>

<style scoped lang="scss">
.complex-demo {
  width: 100%;

  .complex-demo__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: var(--demo-muted);
    font-size: 12px;

    span {
      padding: 4px 8px;
      border: 1px solid #e3e9f2;
      border-radius: 999px;
      background: #fafbfd;
    }

    small {
      color: #738199;
    }
  }

  .complex-demo__status {
    border: 0;

    &.complex-demo__status--draft {
      color: #68758a;
      background: #f1f4f8;
    }

    &.complex-demo__status--confirmed {
      color: #315fae;
      background: #edf3ff;
    }

    &.complex-demo__status--delivering {
      color: #a66615;
      background: #fff4df;
    }

    &.complex-demo__status--completed {
      color: #25855a;
      background: #e9f8ef;
    }
  }
}

@media (max-width: 767px) {
  .complex-demo {
    .complex-demo__toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
  }
}
</style>
