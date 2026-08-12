<script setup lang="ts">
/**
 * 组件名称：DataGrid 表格配置弹窗
 * 使用场景：用于调整 DataGrid 列的显隐、顺序和固定位置，并通过独立入口恢复默认配置。
 */

import {
  ArrowLeftBold,
  ArrowRightBold,
  Minus,
  QuestionFilled,
  Rank,
  RefreshLeft,
} from '@element-plus/icons-vue'
import { formContextKey } from 'element-plus'
import { computed, provide, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import type { DataGridColumnSettingItem } from './types'

interface Props {
  /** 是否展示表格配置弹窗。 */
  modelValue: boolean

  /** 当前允许用户配置的列。 */
  columns: DataGridColumnSettingItem[]

  /** 至少需要保留的可见列数量。 */
  minVisibleCount?: number

  /** 是否展示用于开发定位的列字段名。 */
  showFieldName?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  minVisibleCount: 1,
  showFieldName: false,
})

// 表格配置属于查看能力，不继承外层业务表单的禁用状态。
provide(formContextKey, undefined as never)

const emit = defineEmits<{
  /** 弹窗打开状态由用户关闭或完成操作后变化时触发。 */
  'update:modelValue': [value: boolean]

  /** 用户确认保存列配置时触发。 */
  save: [columns: DataGridColumnSettingItem[]]

  /** 用户二次确认恢复默认列配置后触发。 */
  reset: []
}>()

const draftColumns = ref<DataGridColumnSettingItem[]>([])
const resetConfirmVisible = ref(false)

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const visibleCount = computed(() => draftColumns.value.filter((item) => item.visible).length)

const orderModifiedFields = computed(() => {
  const fields = new Set<string>()
  const fixedOrder = ['left', null, 'right'] as const
  fixedOrder.forEach((fixed) => {
    const currentGroup = draftColumns.value.filter((item) => item.fixed === fixed)
    const defaultGroup = [...currentGroup].sort((a, b) => a.defaultIndex - b.defaultIndex)
    currentGroup.forEach((item, index) => {
      if (item.field !== defaultGroup[index]?.field) {
        fields.add(item.field)
      }
    })
  })
  return fields
})

const modifiedCount = computed(() =>
  draftColumns.value.reduce(
    (count, item) =>
      count +
      Number(isOrderModified(item)) +
      Number(isVisibilityModified(item)) +
      Number(isSummaryModified(item)) +
      Number(isFixedModified(item)),
    0,
  ),
)

function cloneColumns() {
  draftColumns.value = props.columns.map((item) => ({
    ...item,
    defaultState: { ...item.defaultState },
  }))
  normalizeFixedOrder()
}

function normalizeFixedOrder() {
  const fixedOrder = ['left', null, 'right'] as const
  draftColumns.value = fixedOrder.flatMap((fixed) =>
    draftColumns.value.filter((item) => item.fixed === fixed),
  )
}

function changeFixed(item: DataGridColumnSettingItem, value: string | number | boolean) {
  item.fixed = value === 'left' || value === 'right' ? value : null
  normalizeFixedOrder()
}

function canMoveColumn(event: {
  draggedContext: {
    element: DataGridColumnSettingItem
    futureIndex: number
  }
  relatedContext: {
    element?: DataGridColumnSettingItem
  }
}) {
  const fixed = event.draggedContext.element.fixed
  const relatedColumn = event.relatedContext.element
  if (relatedColumn) {
    return relatedColumn.fixed === fixed
  }
  const groupIndexes = draftColumns.value.flatMap((item, index) =>
    item.fixed === fixed ? [index] : [],
  )
  const firstIndex = groupIndexes[0]
  const lastIndex = groupIndexes[groupIndexes.length - 1]
  return (
    firstIndex !== undefined &&
    lastIndex !== undefined &&
    event.draggedContext.futureIndex >= firstIndex &&
    event.draggedContext.futureIndex <= lastIndex
  )
}

function isVisibilityDisabled(item: DataGridColumnSettingItem) {
  return (
    !item.hideable || (item.visible && visibleCount.value <= Math.max(0, props.minVisibleCount))
  )
}

function isOrderModified(item: DataGridColumnSettingItem) {
  return orderModifiedFields.value.has(item.field)
}

function isVisibilityModified(item: DataGridColumnSettingItem) {
  return item.visible !== !item.defaultState.hide
}

function isSummaryModified(item: DataGridColumnSettingItem) {
  return item.summarizable && Boolean(item.summary) !== Boolean(item.defaultState.summary)
}

function isFixedModified(item: DataGridColumnSettingItem) {
  return item.fixed !== item.defaultState.fixed
}

function isItemModified(item: DataGridColumnSettingItem) {
  return (
    isOrderModified(item) ||
    isVisibilityModified(item) ||
    isSummaryModified(item) ||
    isFixedModified(item)
  )
}

function getVisibilityTooltip(item: DataGridColumnSettingItem) {
  if (!item.hideable) {
    return '该列为必显列，不能隐藏；保存配置时也会始终保持显示。'
  }
  const currentLabel = item.visible ? '显示' : '隐藏'
  const defaultLabel = item.defaultState.hide ? '隐藏' : '显示'
  return isVisibilityModified(item)
    ? `当前：${currentLabel}；代码默认：${defaultLabel}。保存后会持久化当前选择。`
    : `当前：${currentLabel}；与代码默认值一致。`
}

function getSummaryTooltip(item: DataGridColumnSettingItem) {
  const currentLabel = item.summary ? '开启' : '关闭'
  const defaultLabel = item.defaultState.summary ? '开启' : '关闭'
  return isSummaryModified(item)
    ? `当前：${currentLabel}；代码默认：${defaultLabel}。保存后会按当前数据范围统计。`
    : `当前：${currentLabel}；与代码默认值一致。`
}

function getFixedLabel(fixed: DataGridColumnSettingItem['fixed']) {
  return fixed === 'left' ? '固定到左侧' : fixed === 'right' ? '固定到右侧' : '不固定'
}

function getFixedTooltip(label: string, item: DataGridColumnSettingItem) {
  const currentLabel = getFixedLabel(item.fixed)
  const defaultLabel = getFixedLabel(item.defaultState.fixed)
  return isFixedModified(item)
    ? `${label}。当前：${currentLabel}；代码默认：${defaultLabel}。`
    : `${label}。当前固定位置与代码默认值一致。`
}

function save() {
  emit(
    'save',
    draftColumns.value.map((item) => ({
      ...item,
      hide: !item.visible,
    })),
  )
}

function confirmReset() {
  resetConfirmVisible.value = true
}

function resetColumnSetting() {
  resetConfirmVisible.value = false
  emit('reset')
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      cloneColumns()
    }
  },
)

watch(
  () => props.columns,
  () => {
    if (props.modelValue) {
      cloneColumns()
    }
  },
  { deep: true },
)
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    class="data-grid-column-setting-dialog"
    title="表格配置"
    width="min(640px, calc(100vw - 32px))"
    append-to-body
    destroy-on-close
  >
    <template #header>
      <div class="data-grid-column-setting data-grid-column-setting__dialog-title">
        <span>表格配置</span>
        <el-tooltip
          v-if="modifiedCount"
          content="按排序、显示、合计和固定位置分别统计；改回代码默认值后会自动减少。"
          placement="top"
          popper-class="data-grid-column-setting-tooltip"
        >
          <span class="data-grid-column-setting__modified-count">
            已调整 {{ modifiedCount }} 项
          </span>
        </el-tooltip>
      </div>
    </template>

    <div class="data-grid-column-setting">
      <el-scrollbar max-height="48vh" class="data-grid-column-setting__scrollbar">
        <div class="data-grid-column-setting__header">
          <span class="data-grid-column-setting__header-cell is-centered">
            排序
            <el-tooltip v-if="showFieldName" popper-class="data-grid-column-setting-tooltip">
              <template #content>
                <div class="data-grid-column-setting__tooltip-content">
                  <p>用于调整列在表格中的显示顺序，按住拖拽图标即可移动。</p>
                  <ul>
                    <li>只能在左固定、普通或右固定的当前分区内移动。</li>
                    <li>跨分区请先修改该列的固定位置。</li>
                    <li>保存后，调整后的顺序会持久化。</li>
                  </ul>
                </div>
              </template>
              <el-icon class="data-grid-column-setting__help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
          <span
            class="data-grid-column-setting__header-cell data-grid-column-setting__visibility-title is-centered"
          >
            显示
            <el-tooltip popper-class="data-grid-column-setting-tooltip">
              <template #content>
                <div class="data-grid-column-setting__tooltip-content">
                  <p>用于控制列是否显示，勾选后显示，取消勾选后隐藏。</p>
                  <ul>
                    <li>必显列不能隐藏。</li>
                    <li>表格必须保留配置要求的最少可见列数。</li>
                    <li>保存后，列的显示状态会持久化。</li>
                  </ul>
                </div>
              </template>
              <el-icon class="data-grid-column-setting__help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
          <span class="data-grid-column-setting__header-cell">
            列名称
            <el-tooltip popper-class="data-grid-column-setting-tooltip">
              <template #content>
                <div class="data-grid-column-setting__tooltip-content">
                  <p>第一行是业务列名，第二行是用于匹配代码列的稳定字段标识。</p>
                  <ul>
                    <li>缓存通过字段标识匹配代码中的列。</li>
                    <li>修改 field 会被视为删除旧列并新增一列。</li>
                  </ul>
                </div>
              </template>
              <el-icon class="data-grid-column-setting__help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
          <span class="data-grid-column-setting__header-cell is-centered">
            合计
            <el-tooltip popper-class="data-grid-column-setting-tooltip">
              <template #content>
                <div class="data-grid-column-setting__tooltip-content">
                  <p>用于控制数字列是否在表格底部显示当前数据范围的合计结果。</p>
                  <ul>
                    <li>只有数字列可以配置合计。</li>
                    <li>合计结果沿用该列的格式化规则。</li>
                    <li>未单独配置聚合方式时，默认使用求和。</li>
                  </ul>
                </div>
              </template>
              <el-icon class="data-grid-column-setting__help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
          <span
            class="data-grid-column-setting__header-cell data-grid-column-setting__fixed-title is-centered"
          >
            固定
            <el-tooltip popper-class="data-grid-column-setting-tooltip">
              <template #content>
                <div class="data-grid-column-setting__tooltip-content">
                  <p>用于将列固定在表格左侧或右侧，未固定的列显示在中间。</p>
                  <ul>
                    <li>固定分区优先于用户设置的列顺序。</li>
                    <li>拖拽只能调整当前分区内的顺序。</li>
                    <li>跨分区请使用该列的固定按钮。</li>
                  </ul>
                </div>
              </template>
              <el-icon class="data-grid-column-setting__help"><QuestionFilled /></el-icon>
            </el-tooltip>
          </span>
        </div>

        <draggable
          v-model="draftColumns"
          item-key="field"
          handle=".data-grid-column-setting__drag"
          animation="180"
          :move="canMoveColumn"
        >
          <template #item="{ element }">
            <div
              class="data-grid-column-setting__item"
              :class="{ 'is-modified': isItemModified(element) }"
            >
              <el-icon
                class="data-grid-column-setting__drag"
                :class="{ 'is-modified': isOrderModified(element) }"
              >
                <Rank />
              </el-icon>
              <el-tooltip
                :content="getVisibilityTooltip(element)"
                placement="top"
                popper-class="data-grid-column-setting-tooltip"
              >
                <el-checkbox
                  v-model="element.visible"
                  class="data-grid-column-setting__visibility"
                  :class="{ 'is-modified': isVisibilityModified(element) }"
                  :disabled="isVisibilityDisabled(element)"
                />
              </el-tooltip>
              <div class="data-grid-column-setting__label">
                <span>{{ element.title }}</span>
                <small v-if="showFieldName">{{ element.field }}</small>
              </div>
              <el-tooltip
                v-if="element.summarizable"
                :content="getSummaryTooltip(element)"
                placement="top"
                popper-class="data-grid-column-setting-tooltip"
              >
                <el-checkbox
                  v-model="element.summary"
                  class="data-grid-column-setting__summary"
                  :class="{ 'is-modified': isSummaryModified(element) }"
                  aria-label="显示合计"
                >
                  <span class="data-grid-column-setting__mobile-label">合计</span>
                </el-checkbox>
              </el-tooltip>
              <span v-else class="data-grid-column-setting__summary-empty">—</span>
              <el-radio-group
                :model-value="element.fixed ?? 'none'"
                :class="{ 'is-modified': isFixedModified(element) }"
                size="small"
                aria-label="固定位置"
                @change="changeFixed(element, $event)"
              >
                <el-tooltip
                  :content="getFixedTooltip('固定到左侧', element)"
                  placement="top"
                  popper-class="data-grid-column-setting-tooltip"
                >
                  <el-radio-button label="left" aria-label="固定到左侧">
                    <el-icon><ArrowLeftBold /></el-icon>
                  </el-radio-button>
                </el-tooltip>
                <el-tooltip
                  :content="getFixedTooltip('取消固定', element)"
                  placement="top"
                  popper-class="data-grid-column-setting-tooltip"
                >
                  <el-radio-button label="none" aria-label="取消固定">
                    <el-icon><Minus /></el-icon>
                  </el-radio-button>
                </el-tooltip>
                <el-tooltip
                  :content="getFixedTooltip('固定到右侧', element)"
                  placement="top"
                  popper-class="data-grid-column-setting-tooltip"
                >
                  <el-radio-button label="right" aria-label="固定到右侧">
                    <el-icon><ArrowRightBold /></el-icon>
                  </el-radio-button>
                </el-tooltip>
              </el-radio-group>
            </div>
          </template>
        </draggable>
      </el-scrollbar>

      <div class="data-grid-column-setting__management">
        <span class="data-grid-column-setting__management-title">配置管理</span>
        <el-button
          class="data-grid-column-setting__reset"
          :icon="RefreshLeft"
          link
          type="danger"
          @click="confirmReset"
        >
          恢复默认配置
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="resetConfirmVisible"
    title="恢复默认表格配置？"
    width="min(440px, calc(100vw - 32px))"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <p>当前表格的列顺序、显隐、宽度、固定和合计等全部用户配置将被清除。</p>
    <template #footer>
      <el-button @click="resetConfirmVisible = false">取消</el-button>
      <el-button type="danger" @click="resetColumnSetting">确认恢复</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.data-grid-column-setting {
  min-width: 0;

  &.data-grid-column-setting__dialog-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--el-dialog-title-font-size);
    line-height: var(--el-dialog-font-line-height);
    color: var(--el-text-color-primary);
  }

  .data-grid-column-setting__modified-count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);

    &::before {
      width: 4px;
      height: 4px;
      content: '';
      background: var(--el-color-primary-light-5);
      border-radius: 50%;
    }
  }

  .data-grid-column-setting__header {
    display: grid;
    grid-template-columns: 52px 52px minmax(104px, 1fr) 60px 104px;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 4px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .data-grid-column-setting__header-cell {
    display: flex;
    align-items: center;
    gap: 3px;
    min-width: 0;

    &.is-centered {
      justify-content: center;
    }
  }

  .data-grid-column-setting__help {
    flex: none;
    color: var(--el-text-color-placeholder);
    cursor: help;
  }

  .data-grid-column-setting__scrollbar {
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  /*
	 * 固定五列轨道保证拖动、显隐、列名、合计和固定方式不会因内容变化发生横向跳动；
	 * 调整弹窗宽度时需要同步检查列名轨道的最小宽度。
	 */
  .data-grid-column-setting__item {
    display: grid;
    grid-template-columns: 52px 52px minmax(104px, 1fr) 60px 104px;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding: 6px 4px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    &.is-modified {
      box-shadow: inset 1px 0 0 var(--el-color-primary-light-7);
    }

    &:last-child {
      border-bottom: 0;
    }
  }

  .data-grid-column-setting__drag,
  .data-grid-column-setting__visibility,
  .data-grid-column-setting__summary {
    &.is-modified {
      color: var(--el-text-color-regular);
      background: var(--el-color-primary-light-9);
      border-radius: 4px;
    }
  }

  .data-grid-column-setting__drag {
    justify-self: center;
    color: var(--el-text-color-secondary);
    cursor: grab;
  }

  .data-grid-column-setting__visibility {
    justify-self: center;
    margin-right: 0;
  }

  .data-grid-column-setting__visibility-title {
    justify-self: center;
  }

  :deep(.el-radio-group) {
    justify-self: stretch;

    &.is-modified {
      border-radius: 4px;
      box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
    }

    .el-radio-button {
      flex: 1;
    }

    .el-radio-button__inner {
      width: 100%;
      padding-right: 8px;
      padding-left: 8px;
    }
  }

  .data-grid-column-setting__label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 20px;

    span,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .data-grid-column-setting__summary-empty {
    font-size: 13px;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  .data-grid-column-setting__summary {
    justify-self: center;
  }

  .data-grid-column-setting__mobile-label {
    display: none;
  }

  .data-grid-column-setting__management {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-top: 16px;
  }

  .data-grid-column-setting__management-title {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .data-grid-column-setting__reset {
    margin-left: auto;
  }
}

/*
 * 规则说明信息较长，限制浮层宽度后更容易逐条阅读。
 */
:global(.data-grid-column-setting-tooltip) {
  max-width: 320px;
  line-height: 20px;
}

.data-grid-column-setting__tooltip-content {
  p {
    margin: 0;
  }

  ul {
    margin: 4px 0 0;
    padding-left: 18px;
    list-style: disc;
  }
}

@media (max-width: 560px) {
  .data-grid-column-setting {
    .data-grid-column-setting__header {
      grid-template-columns: 44px 44px minmax(104px, 1fr);

      span:nth-child(4),
      .data-grid-column-setting__fixed-title {
        display: none;
      }
    }

    .data-grid-column-setting__item {
      grid-template-columns: 44px 44px minmax(104px, 1fr);
      padding: 10px 4px;
    }

    .data-grid-column-setting__summary,
    .data-grid-column-setting__summary-empty {
      grid-row: 2;
      grid-column: 2;
    }

    .data-grid-column-setting__mobile-label {
      display: inline;
    }

    :deep(.el-radio-group) {
      grid-row: 2;
      grid-column: 3;
    }
  }
}
</style>
