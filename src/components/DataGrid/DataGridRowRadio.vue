<script setup lang="ts" generic="Row extends DataGridRow = DataGridRow">
/**
 * 组件名称：DataGrid 单选行控件
 * 使用场景：用于 DataGrid 单选模式的系统选择列，以 Radio 视觉和语义切换当前选中行。
 */

import type { ICellRendererParams, IRowNode } from 'ag-grid-community'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { DataGridRowRadioProps } from './rowRadio'
import type { DataGridRow } from './types'

const props = withDefaults(defineProps<DataGridRowRadioProps<Row>>(), {})
const currentParams = shallowRef(props.params)
const selected = ref(false)
const disabled = ref(false)
let boundNode: IRowNode<Row> | undefined

const selectionLabel = computed(() => {
  const rowIndex = currentParams.value.node.rowIndex
  const rowDescription = rowIndex === null ? '当前行' : `第 ${rowIndex + 1} 行`
  return selected.value ? `${rowDescription}已选择（单选）` : `选择${rowDescription}（单选）`
})

function syncState() {
  selected.value = currentParams.value.node.isSelected() === true
  disabled.value =
    !currentParams.value.node.selectable || Boolean(currentParams.value.node.rowPinned)
}

function unbindNode() {
  boundNode?.removeEventListener('rowSelected', syncState)
  boundNode?.removeEventListener('selectableChanged', syncState)
  boundNode = undefined
}

function bindNode() {
  unbindNode()
  boundNode = currentParams.value.node
  boundNode.addEventListener('rowSelected', syncState)
  boundNode.addEventListener('selectableChanged', syncState)
  syncState()
}

function selectRow() {
  if (disabled.value || selected.value) {
    return
  }
  currentParams.value.node.setSelected(true, true, 'checkboxSelected')
}

function refresh(params: ICellRendererParams<Row>) {
  currentParams.value = params
  bindNode()
  return true
}

onMounted(bindNode)
onBeforeUnmount(unbindNode)

defineExpose({ refresh })
</script>

<template>
  <label
    class="data-grid-row-radio ag-input-wrapper ag-radio-button-input-wrapper"
    :class="{ 'ag-checked': selected, 'ag-disabled': disabled }"
  >
    <input
      class="ag-radio-button-input"
      type="radio"
      :checked="selected"
      :disabled="disabled"
      :aria-label="selectionLabel"
      tabindex="-1"
      @click.stop
      @change="selectRow"
      @keydown.enter.prevent.stop="selectRow"
      @keydown.space.prevent.stop="selectRow"
    />
  </label>
</template>
