<script setup lang="ts">
/**
 * 组件名称：DataGrid 共享浮层编辑器
 * 使用场景：全表复用一个浮层，为 textarea 和 multiSelect 单元格维护本地草稿及显式确认、取消交互。
 */

import { computed, nextTick, ref } from 'vue'
import { getColumnOptions, isColumnOptionsLoading } from './options'
import type { DataGridPopupEditorContext, DataGridPopupEditorExpose } from './popupEditor'
import type { DataGridRow } from './types'
import { resolveEditorComponentProps } from './utils'

const visible = ref(false)
const context = ref<DataGridPopupEditorContext>()
const anchor = ref<HTMLElement>()
const draft = ref<unknown>()
const textareaRef = ref<{ focus?: () => void }>()
const multiSelectRef = ref<{ focus?: () => void }>()

const isTextarea = computed(() => context.value?.type === 'textarea')
const options = computed(() => (context.value ? getColumnOptions(context.value.column) : []))
const optionsLoading = computed(() =>
  context.value ? isColumnOptionsLoading(context.value.column) : false,
)
const componentProps = computed(() => {
  const current = context.value
  return current
    ? resolveEditorComponentProps(current.editor, {
        row: current.row,
        dataIndex: current.dataIndex,
        displayIndex: current.displayIndex,
        field: current.column.field,
        value: current.value,
      })
    : {}
})
const panelWidth = computed(() => (isTextarea.value ? 420 : 360))
const textDraft = computed<string>({
  get: () => String(draft.value ?? ''),
  set: (value) => {
    draft.value = value
  },
})
const multiSelectDraft = computed<unknown[]>({
  get: () => (Array.isArray(draft.value) ? draft.value : []),
  set: (value) => {
    draft.value = value
  },
})

/** 在浮层完成过渡并渲染真实控件后恢复键盘焦点。 */
function focusControl() {
  const control = isTextarea.value ? textareaRef.value : multiSelectRef.value
  control?.focus?.()
}

/** 关闭浮层并丢弃只存在于宿主内部的临时草稿。 */
function close() {
  visible.value = false
  context.value = undefined
  anchor.value = undefined
  draft.value = undefined
}

/** 使用最新单元格锚点和值打开共享浮层。 */
function open<Row extends DataGridRow>(nextContext: DataGridPopupEditorContext<Row>) {
  visible.value = false
  nextTick(() => {
    context.value = nextContext as unknown as DataGridPopupEditorContext
    anchor.value = nextContext.anchor
    draft.value = Array.isArray(nextContext.value) ? [...nextContext.value] : nextContext.value
    visible.value = true
  })
}

/** 用户确认后提交一次完整草稿；事务拒绝时保留浮层供继续修改。 */
function confirm() {
  if (!context.value || !context.value.confirm(draft.value)) {
    return
  }
  close()
}

/** 处理浮层键盘协议，普通 textarea Enter 和多选导航不受影响。 */
function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.isComposing) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (isTextarea.value && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    confirm()
  }
}

defineExpose<DataGridPopupEditorExpose>({ open, close })
</script>

<template>
  <el-popover
    v-if="context && anchor"
    :visible="visible"
    :virtual-ref="anchor"
    :width="panelWidth"
    virtual-triggering
    teleported
    placement="bottom-start"
    popper-class="ag-custom-component-popup data-grid-popup-editor__popper"
    @after-enter="focusControl"
  >
    <div class="data-grid-popup-editor" @mousedown.stop @click.stop @keydown="onKeydown">
      <div class="data-grid-popup-editor__header">
        <strong>{{ context.column.title }}</strong>
        <span>{{ isTextarea ? '多行文本编辑' : '多项选择' }}</span>
      </div>

      <el-input
        v-if="isTextarea"
        ref="textareaRef"
        v-model="textDraft"
        v-bind="componentProps"
        type="textarea"
        :rows="Number(componentProps.rows ?? 6)"
        resize="none"
      />

      <el-select
        v-else
        ref="multiSelectRef"
        v-model="multiSelectDraft"
        v-bind="componentProps"
        :loading="optionsLoading"
        :disabled="optionsLoading"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        :max-collapse-tags="1"
        teleported
        popper-class="ag-custom-component-popup data-grid-popup-editor__select-popper"
      >
        <el-option
          v-for="option in options"
          :key="`${typeof option.value}:${String(option.value)}`"
          :label="option.label"
          :value="option.value"
          :disabled="option.disabled"
        />
      </el-select>

      <div
        class="data-grid-popup-editor__actions"
        :style="{
          marginTop: isTextarea && componentProps?.showWordLimit ? '12px' : undefined,
        }"
      >
        <el-button @click="close">取消</el-button>
        <el-button type="primary" @click="confirm">确定</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped lang="scss">
.data-grid-popup-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .data-grid-popup-editor__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    span {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .data-grid-popup-editor__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    :deep(.el-button + .el-button) {
      margin-left: 0;
    }
  }

  :deep(.el-select) {
    width: 100%;
  }
}
</style>
