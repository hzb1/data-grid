<script setup lang="ts">
/**
 * 组件名称：筛选与行选择演示
 * 使用场景：用于展示 DataGrid 表头筛选、连续行号、过滤范围全选和受控选择状态。
 */

import { ref } from 'vue'
import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'
import type {
  DataGridColumn,
  DataGridFilterItem,
  DataGridRowKey,
} from '@data-grid/components/DataGrid/types'
import {
  categoryOptions,
  createPurchaseRows,
  supplierOptions,
  type PurchaseRow,
} from '@demo/data/purchase'

const rows = ref(createPurchaseRows())
const selectedRowKeys = ref<DataGridRowKey[]>([])
const activeFilters = ref<DataGridFilterItem<PurchaseRow>[]>([])

const columns: DataGridColumn<PurchaseRow>[] = [
  {
    field: 'sku',
    title: '商品编码',
    fixed: 'left',
    width: 128,
    searchType: 'text',
    filter: { placeholder: '搜索编码' },
  },
  {
    field: 'productName',
    title: '商品名称',
    minWidth: 190,
    flex: 1,
    align: 'left',
    searchType: 'text',
    filter: { placeholder: '搜索商品' },
  },
  {
    field: 'category',
    title: '分类',
    width: 120,
    options: categoryOptions,
    formatter: (value) => categoryOptions.find((option) => option.value === value)?.label ?? '—',
    searchType: 'select',
    filter: { placeholder: '选择分类' },
  },
  {
    field: 'supplier',
    title: '供应商',
    width: 132,
    options: supplierOptions,
    formatter: (value) => supplierOptions.find((option) => option.value === value)?.label ?? '—',
    searchType: 'select',
    filter: { placeholder: '选择供应商' },
  },
  {
    field: 'quantity',
    title: '数量',
    width: 104,
    align: 'right',
    searchType: 'numberRange',
    filter: { placeholder: '数量范围' },
  },
  {
    field: 'deliveryDate',
    title: '交付日期',
    width: 136,
    searchType: 'dateRange',
    filter: { placeholder: '日期范围' },
  },
]
</script>

<template>
  <div class="filter-demo">
    <div class="filter-demo__status" aria-live="polite">
      <span>{{ activeFilters.length }} 个筛选条件</span>
      <span>{{ selectedRowKeys.length }} 行已选择</span>
    </div>

    <!-- DataGrid 高性能表格 -->
    <!-- @vue-generic {PurchaseRow} -->
    <DataGrid
      v-model="rows"
      v-model:selected-row-keys="selectedRowKeys"
      :columns="columns"
      row-key="id"
      :height="438"
      :height-resize="false"
      :show-fullscreen-button="false"
      :row-numbering="true"
      :row-selection="{
        mode: 'multiple',
        selectOnRowClick: true,
        selectAll: 'filtered',
      }"
      :clipboard="false"
      @filter-change="activeFilters = $event"
    />
  </div>
</template>

<style scoped lang="scss">
.filter-demo {
  .filter-demo__status {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-bottom: 12px;

    span {
      padding: 5px 10px;
      border: 1px solid #e3e9f2;
      border-radius: 999px;
      color: #647086;
      font-size: 12px;
      background: #fafbfd;
    }
  }
}
</style>
