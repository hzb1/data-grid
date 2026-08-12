<script setup lang="ts">
/**
 * 组件名称：DataGrid 常显单元格编辑器
 * 使用场景：在可编辑单元格中持续展示任意编辑控件，并把未提交内容交由 DataGrid 草稿中心管理。
 */

import { computed, ref } from 'vue'
import DataGridEditorControl from './DataGridEditorControl.vue'
import DataGridMultiSelectCell from './DataGridMultiSelectCell.vue'
import type { DataGridPopupEditorContext } from './popupEditor'
import DataGridTextareaCell from './DataGridTextareaCell.vue'
import type { DataGridColumn, DataGridEditorConfig, DataGridRow, DataGridRowKey } from './types'

/** AG Grid 传递给 DataGrid 常显编辑器的参数。 */
interface PersistentEditorParams {
  /** 当前单元格的业务原值。 */
  value: unknown

  /** 当前单元格所属的业务行。 */
  data: DataGridRow

  /** 当前业务行在排序和筛选后的视图位置。 */
  node: { rowIndex: number | null }

  /** 当前业务行在原始受控数组中的位置。 */
  dataGridDataIndex: number

  /** 当前业务行的稳定唯一标识。 */
  dataGridRowKey: DataGridRowKey

  /** 当前单元格对应的业务列配置。 */
  dataGridColumn: DataGridColumn<DataGridRow>

  /** 当前单元格使用的常显编辑配置。 */
  dataGridEditor: DataGridEditorConfig<DataGridRow>

  /** AG Grid 当前单元格的宿主元素，用作共享浮层的定位锚点。 */
  eGridCell: HTMLElement

  /** 返回当前单元格草稿或业务原值。 */
  dataGridGetDraftValue: (rowKey: DataGridRowKey, field: string, sourceValue: unknown) => unknown

  /** 控件内容变化时保存当前单元格草稿。 */
  dataGridUpdateDraft: (
    rowKey: DataGridRowKey,
    field: string,
    sourceValue: unknown,
    value: unknown,
  ) => void

  /** 用户确认输入后提交当前单元格草稿，并返回事务是否接受当前值。 */
  dataGridCommitDraft: (rowKey: DataGridRowKey, field: string) => boolean

  /** 用户撤销输入时删除当前单元格草稿。 */
  dataGridCancelDraft: (rowKey: DataGridRowKey, field: string) => void

  /** 请求 DataGrid 使用全表唯一宿主打开复杂控件浮层。 */
  dataGridOpenPopupEditor?: (context: DataGridPopupEditorContext) => void
}

interface Props {
  /** AG Grid 适配层传入的行、列、草稿和提交参数。 */
  params: PersistentEditorParams
}

const props = withDefaults(defineProps<Props>(), {})

const currentParams = ref(props.params)
const value = ref(resolveDraftValue(props.params))
const field = computed(() => String(currentParams.value.dataGridColumn.field))
const popupEditorType = computed(() => {
  const type = currentParams.value.dataGridEditor.type
  return type === 'textarea' || type === 'multiSelect' ? type : undefined
})

/** 返回当前参数对应的草稿值。 */
function resolveDraftValue(params: PersistentEditorParams) {
  return params.dataGridGetDraftValue(
    params.dataGridRowKey,
    String(params.dataGridColumn.field),
    params.value,
  )
}

/** 把控件最新内容写入 DataGrid 草稿中心。 */
function updateValue(nextValue: unknown) {
  value.value = nextValue
  currentParams.value.dataGridUpdateDraft(
    currentParams.value.dataGridRowKey,
    field.value,
    currentParams.value.value,
    nextValue,
  )
}

/** 提交当前控件中尚未提交的草稿。 */
function commit() {
  return currentParams.value.dataGridCommitDraft(currentParams.value.dataGridRowKey, field.value)
}

/** 撤销当前控件的草稿并恢复业务原值。 */
function cancel() {
  currentParams.value.dataGridCancelDraft(currentParams.value.dataGridRowKey, field.value)
  value.value = currentParams.value.value
}

/** 请求共享宿主打开复杂控件，并在用户确认后一次性写入并提交草稿。 */
function openPopupEditor() {
  const params = currentParams.value
  const type = popupEditorType.value
  if (!type || !params.dataGridOpenPopupEditor) {
    return
  }
  const popupContext = {
    anchor: params.eGridCell,
    type,
    rowKey: params.dataGridRowKey,
    row: params.data,
    dataIndex: params.dataGridDataIndex,
    displayIndex: params.node.rowIndex ?? -1,
    column: params.dataGridColumn,
    editor: params.dataGridEditor,
    value: value.value,
    confirm: (nextValue) => {
      value.value = nextValue
      params.dataGridUpdateDraft(
        params.dataGridRowKey,
        String(params.dataGridColumn.field),
        params.value,
        nextValue,
      )
      return params.dataGridCommitDraft(params.dataGridRowKey, String(params.dataGridColumn.field))
    },
  } as DataGridPopupEditorContext
  params.dataGridOpenPopupEditor(popupContext)
}

/** AG Grid 复用当前 Renderer 时同步最新行参数，并优先恢复尚未提交的草稿。 */
function refresh(params: PersistentEditorParams) {
  currentParams.value = params
  value.value = resolveDraftValue(params)
  return true
}

defineExpose({ refresh })
</script>

<template>
  <div
    class="data-grid-persistent-editor"
    :class="{ 'data-grid-persistent-editor--textarea': popupEditorType === 'textarea' }"
  >
    <!-- DataGrid 多行文本单元格 -->
    <DataGridTextareaCell
      v-if="popupEditorType === 'textarea'"
      :value="value"
      @open="openPopupEditor"
    />

    <!-- DataGrid 多选单元格 -->
    <DataGridMultiSelectCell
      v-else-if="popupEditorType === 'multiSelect'"
      :value="value"
      :column="currentParams.dataGridColumn"
      @open="openPopupEditor"
    />

    <!-- DataGrid 共享内联编辑控件 -->
    <DataGridEditorControl
      v-else
      :model-value="value"
      :row="currentParams.data"
      :data-index="currentParams.dataGridDataIndex"
      :display-index="currentParams.node.rowIndex ?? -1"
      :column="currentParams.dataGridColumn"
      :editor="currentParams.dataGridEditor"
      persistent
      @update:model-value="updateValue"
      @commit="commit"
      @cancel="cancel"
    />
  </div>
</template>
