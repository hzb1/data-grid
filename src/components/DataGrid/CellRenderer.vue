<script setup lang="ts">
/**
 * 组件名称：DataGrid 通用单元格渲染器
 * 使用场景：渲染业务插槽、系统汇总内容、Loading 和校验无障碍状态。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import type { DataGridCellLoadingRenderState, DataGridCellSlot, DataGridRow } from './types'

/** DataGrid 传递给通用单元格渲染器的参数。 */
type CellRendererParams = {
  /** 当前单元格的原始值。 */
  value: unknown

  /** 当前单元格所属的行数据。 */
  data: DataGridRow

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前单元格所属的 AG Grid 行节点状态。 */
  node: {
    /** 当前行固定在表格顶部或底部时的位置标识。 */
    rowPinned?: string
  }

  /** 系统列需要覆盖原始值时使用的展示内容。 */
  displayValue?: unknown

  /** 当前业务列对应的自定义单元格插槽。 */
  dataGridSlot?: (payload: DataGridCellSlot) => unknown

  /** 当前单元格对应的 DataGrid 业务列配置。 */
  dataGridColumn?: DataGridCellSlot['column']

  /** 当前单元格的校验错误说明。 */
  dataGridErrorMessage?: string

  /** 当前单元格已经进入可见阶段的 Loading 状态。 */
  dataGridLoading?: DataGridCellLoadingRenderState

  /** AG Grid 当前单元格的宿主元素。 */
  eGridCell?: HTMLElement

  /** AG Grid 用于注册当前自定义单元格 Tooltip 的方法。 */
  setTooltip?: (value: string, shouldDisplayTooltip?: () => boolean) => void

  /** 当前单元格最终需要展示的 Tooltip 文本。 */
  dataGridTooltipText?: string

  /** 当前单元格 Tooltip 的展示方式。 */
  dataGridTooltipMode?: 'always' | 'overflow'

  /** 编辑器显示期间是否暂停当前普通内容 Tooltip。 */
  dataGridTooltipSuppressWhileEditing?: boolean
}

/** 通用单元格渲染组件的属性。 */
interface Props {
  /** AG Grid 适配层传入的中立单元格渲染参数。 */
  params: CellRendererParams
}

const props = withDefaults(defineProps<Props>(), {})
const currentParams = ref(props.params)
const cellSlotComponent = computed(() => currentParams.value.dataGridSlot as Component | undefined)
const summaryLines = computed(() => {
  const value = currentParams.value.displayValue ?? currentParams.value.value
  return Array.isArray(value) ? (value as readonly (string | number)[]) : []
})

/** 判断自定义单元格内容节点自身或任一后代是否发生横向溢出。 */
function isContentOverflowing() {
  const content =
    currentParams.value.eGridCell?.querySelector<HTMLElement>('.data-grid-cell__value')
  return Boolean(
    content &&
    [content, ...content.querySelectorAll<HTMLElement>('*')].some(
      (item) => item.scrollWidth - item.clientWidth >= 1,
    ),
  )
}

/** 根据编辑状态和内容尺寸判断当前 Tooltip 是否应当显示。 */
function shouldDisplayTooltip() {
  const params = currentParams.value
  if (
    params.dataGridTooltipSuppressWhileEditing &&
    params.eGridCell?.classList.contains('ag-cell-inline-editing')
  ) {
    return false
  }
  return params.dataGridTooltipMode === 'always' || isContentOverflowing()
}

/** 同步当前渲染参数对应的宿主无障碍状态与 Tooltip。 */
function syncGridCellState() {
  const params = currentParams.value
  if (params.dataGridErrorMessage) {
    params.eGridCell?.setAttribute('aria-invalid', 'true')
  } else {
    params.eGridCell?.removeAttribute('aria-invalid')
  }
  if (params.setTooltip) {
    params.setTooltip(params.dataGridTooltipText ?? '', shouldDisplayTooltip)
  }
}

/** AG Grid 刷新行数据时复用当前 Vue Renderer，避免销毁并重新挂载单元格。 */
function refresh(params: CellRendererParams) {
  const previousGridCell = currentParams.value.eGridCell
  if (previousGridCell && previousGridCell !== params.eGridCell) {
    previousGridCell.removeAttribute('aria-invalid')
  }
  currentParams.value = params
  syncGridCellState()
  return true
}

watch(
  () => props.params,
  (params) => refresh(params),
)

onMounted(syncGridCellState)

onBeforeUnmount(() => {
  currentParams.value.eGridCell?.removeAttribute('aria-invalid')
})

defineExpose({ refresh })
</script>

<template>
  <span
    class="data-grid-cell"
    :aria-busy="currentParams.dataGridLoading ? 'true' : undefined"
    :aria-invalid="currentParams.dataGridErrorMessage ? 'true' : undefined"
  >
    <span class="data-grid-cell__value">
      <component
        :is="cellSlotComponent"
        v-if="!currentParams.node.rowPinned && cellSlotComponent"
        :row="currentParams.data"
        :value="currentParams.value"
        :data-index="currentParams.dataIndex"
        :display-index="currentParams.displayIndex"
        :column="currentParams.dataGridColumn"
      />
      <span
        v-else-if="currentParams.node.rowPinned && summaryLines.length"
        class="data-grid-cell__summary-lines"
      >
        <span
          v-for="(line, index) in summaryLines"
          :key="index"
          class="data-grid-cell__summary-line"
          >{{ line }}</span
        >
      </span>
      <template v-else>{{ currentParams.displayValue ?? currentParams.value ?? '' }}</template>
    </span>
    <span
      v-if="currentParams.dataGridLoading"
      class="data-grid-cell__status"
      role="status"
      :aria-label="currentParams.dataGridLoading.text"
    />
  </span>
</template>

<style lang="scss">
.data-grid-cell {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;

  .data-grid-cell__value {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .data-grid-cell__summary-lines {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
  }

  .data-grid-cell__summary-line {
    line-height: 22px;
  }

  /*
	 * 状态节点只向辅助技术播报任务，不参与单元格尺寸计算；
	 * 可见 Spinner 统一由 AG Grid 单元格伪元素绘制，避免状态切换挤压业务内容。
	 */
  .data-grid-cell__status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
</style>
