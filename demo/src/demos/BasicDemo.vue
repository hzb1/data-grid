<script setup lang="ts">
/**
 * 组件名称：基础表格演示
 * 使用场景：用于展示 DataGrid 的列宽、固定列、排序、格式化和底部汇总能力。
 */

import { ref } from 'vue'
import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'
import type { DataGridColumn } from '@data-grid/components/DataGrid/types'
import {
  categoryOptions,
  createPurchaseRows,
  supplierOptions,
  type PurchaseRow,
} from '@demo/data/purchase'

const rows = ref(createPurchaseRows())

function findLabel(value: unknown, options: { label: string; value: string }[]) {
  return options.find((option) => option.value === value)?.label ?? '—'
}

const columns: DataGridColumn<PurchaseRow>[] = [
  {
    field: 'sku',
    title: '商品编码',
    fixed: 'left',
    width: 128,
  },
  {
    field: 'productName',
    title: '商品名称',
    minWidth: 190,
    flex: 1,
    align: 'left',
  },
  {
    field: 'category',
    title: '分类',
    width: 116,
    formatter: (value) => findLabel(value, categoryOptions),
  },
  {
    field: 'supplier',
    title: '供应商',
    width: 120,
    formatter: (value) => findLabel(value, supplierOptions),
  },
  {
    field: 'quantity',
    title: '数量',
    width: 92,
    align: 'right',
  },
  {
    field: 'unitPrice',
    title: '未税单价',
    width: 118,
    align: 'right',
    formatter: (value) => `¥${Number(value).toLocaleString('zh-CN')}`,
  },
  {
    field: 'amount',
    title: '金额',
    width: 130,
    align: 'right',
    formatter: (value) => '¥' + Number(value).toLocaleString('zh-CN'),
    summary: {
      method: 'sum',
      formatter: (value) => `¥${Number(value).toLocaleString('zh-CN')}`,
    },
  },
  {
    field: 'deliveryDate',
    title: '交付日期',
    width: 128,
  },
]
</script>

<template>
  <div class="basic-demo">
    <!-- DataGrid 高性能表格 -->
    <!-- @vue-generic {PurchaseRow} -->
    <DataGrid
      v-model="rows"
      :columns="columns"
      row-key="id"
      :height="406"
      :height-resize="false"
      :show-fullscreen-button="false"
      :summary="{ label: '当前采购合计', scope: 'all' }"
      :clipboard="false"
    />
  </div>
</template>

<style scoped>
.basic-demo {
  width: 100%;
}
</style>
