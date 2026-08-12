<script setup lang="ts">
/**
 * 组件名称：DataGrid 多选单元格
 * 使用场景：在固定行高单元格中折叠回显多选结果，并请求打开共享浮层完成选择。
 */

import { ArrowDown } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { formatOptionValue, getColumnOptions } from './options'
import type { DataGridColumn, DataGridRow } from './types'

/** DataGrid 多选单元格的属性。 */
interface Props {
  /** 当前单元格选中的原始值数组。 */
  value: unknown

  /** 当前单元格对应的业务列配置。 */
  column: DataGridColumn<DataGridRow>
}

const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits<{
  /** 用户点击或通过键盘激活单元格编辑入口时触发。 */
  open: []
}>()

const values = computed(() => (Array.isArray(props.value) ? props.value : []))
const labels = computed(() =>
  values.value.map(
    (value) => formatOptionValue(getColumnOptions(props.column), value) ?? String(value),
  ),
)
</script>

<template>
  <button
    class="data-grid-multi-select-cell"
    type="button"
    title="编辑多选内容"
    @mousedown.stop
    @click.stop="emit('open')"
  >
    <span v-if="labels.length" class="data-grid-multi-select-cell__tag">{{ labels[0] }}</span>
    <span v-if="labels.length > 1" class="data-grid-multi-select-cell__count"
      >+{{ labels.length - 1 }}</span
    >
    <span v-if="!labels.length" class="data-grid-multi-select-cell__placeholder">请选择</span>
    <el-icon class="data-grid-multi-select-cell__icon" aria-hidden="true"><ArrowDown /></el-icon>
  </button>
</template>

<style scoped lang="scss">
.data-grid-multi-select-cell {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  width: 100%;
  height: var(--el-component-size);
  padding: 0 8px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  cursor: pointer;

  .data-grid-multi-select-cell__tag {
    min-width: 0;
    padding: 1px 6px;
    overflow: hidden;
    color: var(--el-text-color-regular);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-small);
  }

  .data-grid-multi-select-cell__count {
    flex: 0 0 auto;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .data-grid-multi-select-cell__placeholder {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--el-text-color-placeholder);
    text-align: left;
  }

  .data-grid-multi-select-cell__icon {
    flex: 0 0 auto;
    margin-left: auto;
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
