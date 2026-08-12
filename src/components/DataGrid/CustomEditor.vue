<script setup lang="ts">
/**
 * 组件名称：DataGrid 自定义按需单元格编辑器
 * 使用场景：承载业务自定义控件，并适配 AG Grid 的编辑器生命周期和显式提交协议。
 */

import { nextTick, ref } from 'vue'
import DataGridEditorControl from './DataGridEditorControl.vue'
import type { DataGridColumn, DataGridEditorConfig, DataGridRow } from './types'

interface Props {
  /** AG Grid 适配层传入的中立编辑器参数。 */
  params: {
    /** 当前单元格的原始值。 */
    value: unknown

    /** 当前业务行。 */
    data: DataGridRow

    /** AG Grid 当前展示行节点。 */
    node: { rowIndex: number | null }

    /** 提交当前 AG Grid 编辑器。 */
    stopEditing: () => void

    /** AG Grid API，用于撤销当前编辑器。 */
    api?: { stopEditing: (cancel?: boolean) => void }

    /** 当前 DataGrid 业务列配置。 */
    dataGridColumn: DataGridColumn<DataGridRow>

    /** 当前自定义编辑器配置。 */
    dataGridEditor: Extract<DataGridEditorConfig<DataGridRow>, { type: 'custom' }>

    /** 返回当前业务行在原始受控数组中的位置。 */
    getDataIndex: (row: DataGridRow) => number
  }
}

const props = withDefaults(defineProps<Props>(), {})

const controlRef = ref<InstanceType<typeof DataGridEditorControl>>()
const value = ref(props.params.value)

/** 由业务自定义组件显式确认当前值。 */
function commit() {
  nextTick(() => props.params.stopEditing())
}

/** 由业务自定义组件显式撤销当前值。 */
function cancel() {
  value.value = props.params.value
  nextTick(() => props.params.api?.stopEditing(true))
}

/** 返回 AG Grid 本次编辑应写入业务事务的最终值。 */
function getValue() {
  return value.value
}

/** AG Grid 挂载编辑器后自动聚焦业务控件。 */
function afterGuiAttached() {
  nextTick(() => controlRef.value?.focus())
}

defineExpose({ getValue, afterGuiAttached })
</script>

<template>
  <div class="data-grid-custom-editor">
    <DataGridEditorControl
      ref="controlRef"
      v-model="value"
      :row="params.data"
      :data-index="params.getDataIndex(params.data)"
      :display-index="params.node.rowIndex ?? -1"
      :column="params.dataGridColumn"
      :editor="params.dataGridEditor"
      @commit="commit"
      @cancel="cancel"
    />
  </div>
</template>

<style lang="scss">
.data-grid-custom-editor {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  background: var(--el-bg-color);
}
</style>
