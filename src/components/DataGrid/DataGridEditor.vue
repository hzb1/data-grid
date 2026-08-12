<script setup lang="ts">
/**
 * 组件名称：DataGrid 内置按需单元格编辑器
 * 使用场景：承载共享编辑控件，并适配 AG Grid 的编辑器生命周期。
 */

import { nextTick, ref } from 'vue'
import DataGridEditorControl from './DataGridEditorControl.vue'
import type { DataGridColumn, DataGridEditorConfig, DataGridRow } from './types'

/** DataGrid 内置编辑器配置。 */
type BuiltInEditorConfig = Exclude<DataGridEditorConfig<DataGridRow>, { type: 'custom' }>

interface Props {
  /** AG Grid 适配层传入的值、行数据、列配置和编辑生命周期方法。 */
  params: {
    /** 当前单元格原始值。 */
    value: unknown

    /** 当前编辑单元格所属的完整业务行。 */
    data: DataGridRow

    /** 当前展示行节点。 */
    node: { rowIndex: number | null }

    /** 提交当前 AG Grid 编辑器。 */
    stopEditing: () => void

    /** AG Grid API，用于撤销当前编辑器。 */
    api?: { stopEditing: (cancel?: boolean) => void }

    /** 当前业务列配置。 */
    dataGridColumn: DataGridColumn<DataGridRow>

    /** 当前内置编辑器配置。 */
    dataGridEditor: BuiltInEditorConfig

    /** 返回当前业务行在原始受控数组中的位置。 */
    getDataIndex: (row: DataGridRow) => number
  }
}

const props = withDefaults(defineProps<Props>(), {})

const controlRef = ref<InstanceType<typeof DataGridEditorControl>>()
const value = ref(props.params.value)

/** 提交当前按需编辑值。 */
function commit() {
  nextTick(() => props.params.stopEditing())
}

/** 撤销当前按需编辑值并通知 AG Grid 放弃变更。 */
function cancel() {
  value.value = props.params.value
  nextTick(() => props.params.api?.stopEditing(true))
}

/** 返回 AG Grid 本次编辑应写入业务事务的最终值。 */
function getValue() {
  return value.value
}

/** AG Grid 挂载编辑器后自动聚焦内部控件。 */
function afterGuiAttached() {
  nextTick(() => controlRef.value?.focus())
}

/** 多行文本和日期控件继续使用 AG Grid 弹出编辑容器。 */
function isPopup() {
  return ['textarea', 'date', 'datetime'].includes(props.params.dataGridEditor.type)
}

/** 弹出编辑容器默认展示在当前单元格下方。 */
function getPopupPosition() {
  return 'under'
}

defineExpose({
  getValue,
  afterGuiAttached,
  isPopup,
  getPopupPosition,
})
</script>

<template>
  <div
    class="data-grid-editor"
    :class="[
      `data-grid-editor--${params.dataGridEditor.type}`,
      { 'data-grid-editor--popup': isPopup() },
    ]"
  >
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
.data-grid-editor {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  background: var(--el-bg-color);

  &.data-grid-editor--popup {
    width: 280px;
    height: auto;
    padding: 8px;
    border: 1px solid var(--el-color-primary);
    border-radius: 4px;
    box-shadow: var(--el-box-shadow-light);
  }

  &.data-grid-editor--textarea {
    align-items: stretch;

    &.data-grid-editor--popup {
      height: 120px;
    }
  }

  .data-grid-editor-control__input,
  .data-grid-editor-control__number,
  .data-grid-editor-control__date,
  .data-grid-editor-control__select {
    width: 100%;
  }

  .data-grid-editor-control__switch {
    margin: auto;
  }

  .el-textarea,
  .el-textarea__inner {
    height: 100%;
  }

  .el-textarea__inner {
    resize: none;
  }
}
</style>
