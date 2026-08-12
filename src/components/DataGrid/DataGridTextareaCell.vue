<script setup lang="ts">
/**
 * 组件名称：DataGrid 多行文本单元格
 * 使用场景：在固定行高单元格中展示多行文本摘要，并请求打开共享浮层完成编辑。
 */

import { EditPen } from '@element-plus/icons-vue'

/** DataGrid 多行文本单元格的属性。 */
interface Props {
  /** 当前单元格需要展示的多行文本值。 */
  value: unknown
}

const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits<{
  /** 用户点击或通过键盘激活单元格编辑入口时触发。 */
  open: []
}>()
</script>

<template>
  <button
    class="data-grid-textarea-cell"
    type="button"
    title="编辑多行文本"
    @mousedown.stop
    @click.stop="emit('open')"
  >
    <span
      class="data-grid-textarea-cell__value"
      :class="{ 'is-placeholder': !String(props.value ?? '').trim() }"
    >
      {{ String(props.value ?? '').trim() || '请输入' }}
    </span>
    <el-icon class="data-grid-textarea-cell__icon" aria-hidden="true"><EditPen /></el-icon>
  </button>
</template>

<style scoped lang="scss">
.data-grid-textarea-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  cursor: text;

  .data-grid-textarea-cell__value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-placeholder {
      color: var(--el-text-color-placeholder);
    }
  }

  .data-grid-textarea-cell__icon {
    flex: 0 0 auto;
    color: var(--el-text-color-placeholder);
  }

  &:hover {
    border-color: var(--el-border-color-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary-light-5);
    outline-offset: 0;
    border-color: var(--el-color-primary);
  }
}
</style>
