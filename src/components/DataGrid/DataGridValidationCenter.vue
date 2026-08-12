<script setup lang="ts" generic="Row extends DataGridRow = DataGridRow">
/**
 * 组件名称：DataGrid 校验中心
 * 使用场景：在 DataGrid 工具栏中展示校验进度、错误数量、前后导航和完整错误列表。
 */

import { ArrowLeft, ArrowRight, WarningFilled } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import type {
  DataGridValidationCenterItem,
  DataGridValidationCenterProps,
} from './validationCenter'
import type { DataGridRow } from './types'

const props = withDefaults(defineProps<DataGridValidationCenterProps<Row>>(), {
  currentErrorKey: undefined,
})

const emit = defineEmits<{
  /** 用户点击上一个可定位错误时触发。 */
  previous: []

  /** 用户点击下一个可定位错误时触发。 */
  next: []

  /** 用户点击可见错误并请求定位到对应单元格时触发。 */
  locate: [item: DataGridValidationCenterItem<Row>]

  /** 用户确认清除筛选并定位当前隐藏错误时触发。 */
  'clear-filters-and-locate': [item: DataGridValidationCenterItem<Row>]

  /** 用户从隐藏列错误中请求打开表格列配置时触发。 */
  'open-column-setting': []
}>()

const popoverVisible = ref(false)

const locatableItems = computed(() => props.items.filter((item) => item.status === 'visible'))
const currentLocatableIndex = computed(() =>
  locatableItems.value.findIndex((item) => item.key === props.currentErrorKey),
)
const currentPosition = computed(() =>
  currentLocatableIndex.value >= 0 ? currentLocatableIndex.value + 1 : 0,
)
const canGoPrevious = computed(() => currentLocatableIndex.value > 0)
const canGoNext = computed(
  () =>
    currentLocatableIndex.value >= 0 &&
    currentLocatableIndex.value < locatableItems.value.length - 1,
)
const statusText = computed(() => {
  if (props.validating) {
    return '正在校验…'
  }
  return `${props.items.length} 个校验错误`
})
const shortStatusText = computed(() =>
  props.validating ? '正在校验…' : `${props.items.length} 个错误`,
)

function locate(item: DataGridValidationCenterItem<Row>) {
  popoverVisible.value = false
  emit('locate', item)
}

function clearFiltersAndLocate(item: DataGridValidationCenterItem<Row>) {
  popoverVisible.value = false
  emit('clear-filters-and-locate', item)
}

function openColumnSetting() {
  popoverVisible.value = false
  emit('open-column-setting')
}

watch(
  () => props.items.length,
  (length) => {
    if (!length) {
      popoverVisible.value = false
    }
  },
)
</script>

<template>
  <div
    class="data-grid-validation-center"
    :class="{ 'is-validating': validating }"
    aria-live="polite"
  >
    <el-icon class="data-grid-validation-center__state" :class="{ 'is-validating': validating }">
      <WarningFilled />
    </el-icon>
    <span class="data-grid-validation-center__status" :title="statusText">{{ statusText }}</span>
    <span class="data-grid-validation-center__status is-short" :title="statusText">
      {{ shortStatusText }}
    </span>

    <template v-if="items.length">
      <div class="data-grid-validation-center__navigation">
        <el-tooltip content="上一个校验错误" placement="top">
          <el-button
            class="data-grid-validation-center__nav"
            :icon="ArrowLeft"
            :disabled="!canGoPrevious"
            circle
            text
            aria-label="上一个校验错误"
            @click="emit('previous')"
          />
        </el-tooltip>
        <span class="data-grid-validation-center__progress">
          {{ currentPosition }}/{{ locatableItems.length }}
        </span>
        <el-tooltip content="下一个校验错误" placement="top">
          <el-button
            class="data-grid-validation-center__nav"
            :icon="ArrowRight"
            :disabled="!canGoNext"
            circle
            text
            aria-label="下一个校验错误"
            @click="emit('next')"
          />
        </el-tooltip>
      </div>

      <el-popover
        v-model:visible="popoverVisible"
        :width="420"
        :teleported="false"
        placement="bottom-end"
        popper-class="data-grid-validation-center__popover"
        trigger="click"
      >
        <template #reference>
          <el-button class="data-grid-validation-center__all" link type="danger"
            >查看全部</el-button
          >
        </template>

        <div class="data-grid-validation-center__panel">
          <div class="data-grid-validation-center__heading">
            <strong>校验错误</strong>
            <span>共 {{ items.length }} 项</span>
          </div>
          <ul class="data-grid-validation-center__list" aria-label="表格校验错误列表">
            <li v-for="item in items" :key="item.key" class="data-grid-validation-center__item">
              <button
                v-if="item.status === 'visible'"
                type="button"
                class="data-grid-validation-center__error"
                :class="{ 'is-current': item.key === currentErrorKey }"
                @click="locate(item)"
              >
                <span class="data-grid-validation-center__position">
                  第 {{ item.error.dataIndex + 1 }} 行 · {{ item.error.columnTitle }}
                </span>
                <span class="data-grid-validation-center__message">{{ item.error.message }}</span>
              </button>
              <div v-else class="data-grid-validation-center__error is-unavailable">
                <span class="data-grid-validation-center__position">
                  第 {{ item.error.dataIndex + 1 }} 行 · {{ item.error.columnTitle }}
                </span>
                <span class="data-grid-validation-center__message">{{ item.error.message }}</span>
                <div class="data-grid-validation-center__unavailable">
                  <span>
                    {{ item.status === 'filtered' ? '当前筛选条件下不可见' : '错误列已隐藏' }}
                  </span>
                  <el-button
                    v-if="item.status === 'filtered'"
                    link
                    type="primary"
                    @click="clearFiltersAndLocate(item)"
                  >
                    清除筛选并定位
                  </el-button>
                  <el-button
                    v-else-if="item.columnSettingEnabled"
                    link
                    type="primary"
                    @click="openColumnSetting"
                  >
                    打开列配置
                  </el-button>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </el-popover>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.data-grid-validation-center {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;

  .data-grid-validation-center__state {
    flex: none;
    color: var(--el-color-danger);

    &.is-validating {
      color: var(--el-color-primary);
    }
  }

  .data-grid-validation-center__status {
    max-width: 148px;
    overflow: hidden;
    font-size: 13px;
    color: var(--el-color-danger);
    text-overflow: ellipsis;
    white-space: nowrap;

    &.is-short {
      display: none;
    }
  }

  .data-grid-validation-center__navigation {
    display: flex;
    flex: none;
    align-items: center;
    gap: 2px;
  }

  .data-grid-validation-center__nav {
    width: 26px;
    height: 26px;
    min-width: 26px;
    padding: 0;
    margin: 0;

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
    }
  }

  .data-grid-validation-center__progress {
    min-width: 34px;
    font-size: 12px;
    text-align: center;
    color: var(--el-text-color-secondary);
  }

  .data-grid-validation-center__all {
    flex: none;
    padding: 0 4px;

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
    }
  }

  .data-grid-validation-center__panel {
    display: flex;
    flex-direction: column;
    max-height: 360px;
    min-width: 0;
  }

  .data-grid-validation-center__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 2px 10px;
    color: var(--el-text-color-primary);

    span {
      font-size: 12px;
      font-weight: 400;
      color: var(--el-text-color-secondary);
    }
  }

  .data-grid-validation-center__list {
    flex: 1;
    min-height: 0;
    padding: 0;
    margin: 0;
    overflow-y: auto;
    list-style: none;
  }

  .data-grid-validation-center__item {
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .data-grid-validation-center__error {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 10px 8px;
    color: var(--el-text-color-regular);
    background: transparent;
    border: 0;
    border-radius: 4px;
    text-align: left;

    &:is(button) {
      cursor: pointer;
    }

    &:is(button):hover,
    &:is(button):focus-visible,
    &.is-current {
      background: var(--el-color-danger-light-9);
      outline: none;
    }

    &:is(button):focus-visible {
      box-shadow: 0 0 0 2px var(--el-color-primary-light-7) inset;
    }

    &.is-unavailable {
      color: var(--el-text-color-secondary);
    }
  }

  .data-grid-validation-center__position {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .data-grid-validation-center__message {
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 20px;
    white-space: normal;
  }

  .data-grid-validation-center__unavailable {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  &.is-validating {
    .data-grid-validation-center__status {
      color: var(--el-color-primary);
    }
  }

  @container (max-width: 720px) {
    .data-grid-validation-center__status {
      display: none;

      &.is-short {
        display: inline;
      }
    }
  }
}
</style>
