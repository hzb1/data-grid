<script setup lang="ts">
/**
 * 组件名称：DataGrid 编辑控件
 * 使用场景：统一渲染按需编辑器和常显编辑器使用的内置控件或业务自定义控件。
 */

import { computed, nextTick, ref } from 'vue'
import { getColumnOptions, isColumnOptionsLoading } from './options'
import type { DataGridColumn, DataGridEditorConfig, DataGridRow } from './types'
import { resolveEditorComponentProps } from './utils'

interface Props {
  /** 当前控件维护的草稿值。 */
  modelValue: unknown

  /** 当前编辑单元格所属的完整业务行。 */
  row: DataGridRow

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前编辑单元格对应的完整业务列配置。 */
  column: DataGridColumn<DataGridRow>

  /** 当前单元格使用的编辑器配置。 */
  editor: DataGridEditorConfig<DataGridRow>

  /** 当前控件是否作为常显编辑器渲染。 */
  persistent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  persistent: false,
})

const emit = defineEmits<{
  /** 控件内容变化时同步最新草稿。 */
  (event: 'update:modelValue', value: unknown): void

  /** 当前控件满足确认时机时请求提交草稿。 */
  (event: 'commit'): void

  /** 用户按下 Escape 时请求撤销草稿。 */
  (event: 'cancel'): void
}>()

const RESERVED_COMPONENT_PROPS = new Set([
  'modelValue',
  'onUpdate:modelValue',
  'disabled',
  'readonly',
  'type',
  'multiple',
  'teleported',
  'popperClass',
  'validateEvent',
  'onKeydown',
  'onKeyup',
  'onKeypress',
])

const controlRef = ref<{ focus?: () => void; blur?: () => void }>()
const editorType = computed(() => props.editor.type)
const options = computed(() => getColumnOptions(props.column))
const optionsLoading = computed(() => isColumnOptionsLoading(props.column))
const resolvedComponentProps = computed(() =>
  resolveEditorComponentProps(props.editor, {
    row: props.row,
    dataIndex: props.dataIndex,
    displayIndex: props.displayIndex,
    field: props.column.field,
    value: props.modelValue,
  }),
)
const componentProps = computed<Record<string, unknown>>(() => {
  const source = resolvedComponentProps.value
  return Object.entries(source).reduce<Record<string, unknown>>((result, [key, value]) => {
    if (!RESERVED_COMPONENT_PROPS.has(key)) {
      result[key] = value
    }
    return result
  }, {})
})
const dateFormat = computed(() => {
  const configuredFormat = componentProps.value.format
  return typeof configuredFormat === 'string'
    ? configuredFormat
    : editorType.value === 'datetime'
      ? 'YYYY-MM-DD HH:mm:ss'
      : 'YYYY-MM-DD'
})
const dateValueFormat = computed(() => {
  const configuredValueFormat = componentProps.value.valueFormat
  return typeof configuredValueFormat === 'string'
    ? configuredValueFormat
    : editorType.value === 'datetime'
      ? 'YYYY-MM-DD HH:mm:ss'
      : 'YYYY-MM-DD'
})
const popperClass = computed(() => {
  const configuredClass = resolvedComponentProps.value.popperClass
  return [
    'ag-custom-component-popup',
    'data-grid-editor-control__popper',
    typeof configuredClass === 'string' ? configuredClass : '',
  ]
    .filter(Boolean)
    .join(' ')
})
const collapseTags = computed(() => {
  const configuredValue = componentProps.value.collapseTags
  return typeof configuredValue === 'boolean' ? configuredValue : true
})
const collapseTagsTooltip = computed(() => {
  const configuredValue = componentProps.value.collapseTagsTooltip
  return typeof configuredValue === 'boolean' ? configuredValue : true
})
const maxCollapseTags = computed(() => {
  const configuredValue = componentProps.value.maxCollapseTags
  return typeof configuredValue === 'number' ? configuredValue : 1
})

const textValue = computed({
  get: () => String(props.modelValue ?? ''),
  set: (value: string) => emit('update:modelValue', value),
})
const numberValue = computed<number | undefined>({
  get: () =>
    typeof props.modelValue === 'number'
      ? props.modelValue
      : props.modelValue === '' || props.modelValue === null || props.modelValue === undefined
        ? undefined
        : Number(props.modelValue),
  set: (value) => emit('update:modelValue', value),
})
const dateValue = computed<string | null>({
  get: () =>
    props.modelValue === undefined || props.modelValue === null || props.modelValue === ''
      ? null
      : String(props.modelValue),
  set: (value) => emit('update:modelValue', value),
})
const multiSelectValue = computed<unknown[]>({
  get: () => (Array.isArray(props.modelValue) ? props.modelValue : []),
  set: (value) => emit('update:modelValue', value),
})
const booleanValue = computed<boolean>({
  get: () => Boolean(props.modelValue),
  set: (value) => emit('update:modelValue', value),
})

/** 请求外层提交当前草稿。 */
function commit() {
  emit('commit')
}

/** 请求外层撤销当前草稿。 */
function cancel() {
  emit('cancel')
}

/** 多选编辑器只在弹层收起后提交，避免每次勾选都创建一笔事务。 */
function onMultiSelectVisibleChange(visible: boolean) {
  if (!visible) {
    commit()
  }
}

/** 隔离表格快捷键，并实现各类控件统一的确认和撤销协议。 */
function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.isComposing) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    nextTick(() => controlRef.value?.blur?.())
    return
  }
  if (event.key === 'Tab') {
    commit()
    return
  }
  const shouldCommitTextarea =
    editorType.value === 'textarea' && event.key === 'Enter' && (event.ctrlKey || event.metaKey)
  const shouldCommitSingleLine =
    ['text', 'number'].includes(editorType.value) && event.key === 'Enter'
  if (shouldCommitTextarea || shouldCommitSingleLine) {
    event.preventDefault()
    commit()
    nextTick(() => controlRef.value?.blur?.())
  }
}

/** 聚焦当前 Element Plus 或业务自定义控件。 */
function focus() {
  controlRef.value?.focus?.()
}

/** 使当前 Element Plus 或业务自定义控件失去焦点。 */
function blur() {
  controlRef.value?.blur?.()
}

defineExpose({ focus, blur })
</script>

<template>
  <div
    class="data-grid-editor-control"
    :class="`data-grid-editor-control--${editorType}`"
    @mousedown.stop
    @click.stop
    @keydown="onKeydown"
  >
    <el-input
      v-if="editorType === 'text' || editorType === 'textarea'"
      ref="controlRef"
      v-model="textValue"
      v-bind="componentProps"
      class="data-grid-editor-control__input"
      :type="editorType === 'textarea' ? 'textarea' : 'text'"
      :disabled="false"
      :readonly="false"
      :validate-event="false"
      @blur="commit"
    />

    <el-input-number
      v-else-if="editorType === 'number'"
      ref="controlRef"
      v-model="numberValue"
      v-bind="componentProps"
      class="data-grid-editor-control__number"
      :disabled="false"
      :validate-event="false"
      @blur="commit"
    />

    <el-date-picker
      v-else-if="editorType === 'date' || editorType === 'datetime'"
      ref="controlRef"
      v-model="dateValue"
      v-bind="componentProps"
      class="data-grid-editor-control__date"
      :type="editorType"
      :format="dateFormat"
      :value-format="dateValueFormat"
      :disabled="false"
      :readonly="false"
      :validate-event="false"
      :teleported="persistent"
      :popper-class="popperClass"
      @change="commit"
    />

    <el-select
      v-else-if="editorType === 'select' || editorType === 'multiSelect'"
      ref="controlRef"
      :model-value="editorType === 'multiSelect' ? multiSelectValue : modelValue"
      v-bind="componentProps"
      class="data-grid-editor-control__select"
      :loading="optionsLoading"
      :disabled="optionsLoading"
      :validate-event="false"
      :multiple="editorType === 'multiSelect'"
      :collapse-tags="editorType === 'multiSelect' && collapseTags"
      :collapse-tags-tooltip="editorType === 'multiSelect' && collapseTagsTooltip"
      :max-collapse-tags="maxCollapseTags"
      :teleported="true"
      :popper-class="popperClass"
      @update:model-value="$emit('update:modelValue', $event)"
      @change="editorType === 'select' && commit()"
      @visible-change="editorType === 'multiSelect' && onMultiSelectVisibleChange($event)"
    >
      <el-option
        v-for="option in options"
        :key="`${typeof option.value}:${String(option.value)}`"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </el-select>

    <el-switch
      v-else-if="editorType === 'boolean'"
      ref="controlRef"
      v-model="booleanValue"
      v-bind="componentProps"
      class="data-grid-editor-control__switch"
      :disabled="false"
      :validate-event="false"
      @change="commit"
    />

    <component
      :is="editor.component"
      v-else-if="editor.type === 'custom'"
      ref="controlRef"
      :model-value="modelValue"
      v-bind="componentProps"
      class="data-grid-editor-control__custom"
      :row="row"
      :data-index="dataIndex"
      :display-index="displayIndex"
      :column="column"
      :disabled="false"
      :commit="commit"
      :cancel="cancel"
      @update:model-value="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<style lang="scss">
.data-grid-editor-control {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  height: auto;

  &.data-grid-editor-control--textarea {
    align-items: stretch;
    height: 100%;
  }
}
</style>
