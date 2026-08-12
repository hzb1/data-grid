<script setup lang="ts">
/**
 * 组件名称：编辑与业务校验演示
 * 使用场景：用于展示 DataGrid 内置编辑器、派生金额计算、字段规则和跨字段行校验。
 */

import { ref } from 'vue'
import DataGrid from '@data-grid/components/DataGrid/DataGrid.vue'
import type {
  DataGridColumn,
  DataGridExpose,
  DataGridValidationState,
} from '@data-grid/components/DataGrid/types'
import { createPurchaseRows, supplierOptions, type PurchaseRow } from '@demo/data/purchase'

const rows = ref(createPurchaseRows())
const gridRef = ref<DataGridExpose<PurchaseRow>>()
const validationErrorCount = ref(0)
const submitMessage = ref('尚未执行整表校验')

const columns: DataGridColumn<PurchaseRow>[] = [
  {
    field: 'productName',
    title: '商品名称',
    minWidth: 190,
    flex: 1,
    align: 'left',
    editor: {
      type: 'text',
      editable: true,
      componentProps: { placeholder: '输入商品名称' },
    },
    rules: [{ required: true, message: '商品名称不能为空' }],
  },
  {
    field: 'supplier',
    title: '供应商',
    width: 142,
    options: supplierOptions,
    formatter: (value) => supplierOptions.find((option) => option.value === value)?.label ?? '—',
    editor: {
      type: 'select',
      editable: true,
      componentProps: { placeholder: '选择供应商' },
    },
    rules: [{ required: true, message: '请选择供应商' }],
  },
  {
    field: 'quantity',
    title: '数量',
    width: 116,
    align: 'right',
    editor: {
      type: 'number',
      editable: true,
      componentProps: { min: 0, precision: 0 },
    },
    rules: [
      {
        validator: (value) => (Number(value) > 0 ? true : '采购数量必须大于 0'),
      },
    ],
  },
  {
    field: 'unitPrice',
    title: '未税单价',
    width: 132,
    align: 'right',
    editor: {
      type: 'number',
      editable: true,
      componentProps: { min: 0, precision: 2 },
    },
    rules: [
      {
        validator: (value) => (Number(value) > 0 ? true : '单价必须大于 0'),
      },
    ],
  },
  {
    field: 'amount',
    title: '金额',
    width: 128,
    align: 'right',
    editor: false,
    formatter: (value) => `¥${Number(value).toLocaleString('zh-CN')}`,
  },
  {
    field: 'deliveryDate',
    title: '交付日期',
    width: 146,
    editor: {
      type: 'date',
      editable: true,
      componentProps: { valueFormat: 'YYYY-MM-DD' },
    },
    rules: [{ required: true, message: '请选择交付日期' }],
  },
  {
    field: 'urgent',
    title: '加急',
    width: 94,
    editor: { type: 'boolean', editable: true },
  },
  {
    field: 'note',
    title: '备注',
    minWidth: 180,
    align: 'left',
    editor: {
      type: 'text',
      editable: true,
      componentProps: { placeholder: '加急时必填' },
    },
  },
]

function recalculateAmount(row: PurchaseRow) {
  return {
    ...row,
    amount: Number((Number(row.quantity) * Number(row.unitPrice)).toFixed(2)),
  }
}

function onValidationChange(state: DataGridValidationState<PurchaseRow>) {
  validationErrorCount.value = state.errors.length
}

async function validateAll() {
  const result = await gridRef.value?.validation.validate()
  if (!result) {
    return
  }

  submitMessage.value = result.valid
    ? '全部数据校验通过，可以提交'
    : `发现 ${result.errors.length} 个问题`
}
</script>

<template>
  <div class="edit-demo">
    <div class="edit-demo__toolbar">
      <div aria-live="polite">
        <strong>{{ validationErrorCount }}</strong>
        个校验问题 · {{ submitMessage }}
      </div>
      <button type="button" @click="validateAll">校验全部数据</button>
    </div>

    <!-- DataGrid 高性能表格 -->
    <!-- @vue-generic {PurchaseRow} -->
    <DataGrid
      ref="gridRef"
      v-model="rows"
      :columns="columns"
      row-key="id"
      mode="edit"
      editor-display-mode="always"
      :height="452"
      :height-resize="false"
      :show-fullscreen-button="false"
      :process-row-change="recalculateAmount"
      :row-rules="[
        {
          validator: (row) =>
            row.urgent && !row.note.trim()
              ? { field: 'note', message: '加急采购必须填写备注' }
              : true,
        },
      ]"
      :validation="{ center: true, scrollToFirstError: true }"
      :history="{ limit: 20 }"
      @validation-change="onValidationChange"
    />
  </div>
</template>

<style scoped lang="scss">
.edit-demo {
  .edit-demo__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
    color: var(--demo-muted);
    font-size: 13px;

    strong {
      color: var(--demo-brand);
      font-size: 15px;
    }

    button {
      padding: 8px 14px;
      border: 1px solid #cedaf1;
      border-radius: 8px;
      color: #315da8;
      background: #f6f9ff;
      cursor: pointer;

      &:hover {
        border-color: #9fb7e5;
        background: #edf3ff;
      }
    }
  }
}

@media (max-width: 767px) {
  .edit-demo {
    .edit-demo__toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
  }
}
</style>
