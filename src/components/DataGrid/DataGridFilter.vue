<script setup lang="ts">
/**
 * 组件名称：DataGrid 统一列筛选器
 * 使用场景：根据列 searchType 展示筛选控件，并在用户确认后统一应用筛选模型。
 */

import type { IAfterGuiAttachedParams, IFilterParams, IRowNode } from 'ag-grid-community'
import { formContextKey } from 'element-plus'
import { computed, nextTick, provide, ref } from 'vue'
import {
  cloneDataGridFilterModel,
  doesDataGridFilterPass,
  getDataGridDefaultOperator,
  getDataGridFilterModelText,
  getDataGridFilterOperators,
  getDataGridOperatorLabel,
  isDataGridFilterModelActive,
  validateDataGridFilterModel,
} from './filter'
import { getColumnOptions, isColumnOptionsLoading } from './options'
import type {
  DataGridColumn,
  DataGridFilterModel,
  DataGridFilterOperator,
  DataGridRow,
} from './types'

interface Props {
  /** AG Grid 适配层传入的筛选器参数和项目级列配置。 */
  params: IFilterParams<DataGridRow> & {
    dataGridColumn: DataGridColumn<DataGridRow>
  }
}

const props = withDefaults(defineProps<Props>(), {})

// 筛选是查看能力，不继承外层业务表单的禁用状态。
provide(formContextKey, undefined as never)

const DATE_PICKER_POPPER_OPTIONS = {
  modifiers: [
    { name: 'flip', enabled: false },
    {
      name: 'preventOverflow',
      options: {
        altAxis: true,
        padding: 8,
      },
    },
  ],
}

const DATETIME_RANGE_DEFAULT_TIME = [
  new Date(2000, 0, 1, 0, 0, 0),
  new Date(2000, 0, 1, 23, 59, 59),
]

const filterRef = ref<HTMLElement>()
const controlRef = ref<{ focus?: () => void }>()
const appliedModel = ref<DataGridFilterModel | null>(null)
const draftOperator = ref<DataGridFilterOperator>(
  getDataGridDefaultOperator(props.params.dataGridColumn),
)
const draftValue = ref<unknown>()
const draftValueTo = ref<unknown>()
const validationMessage = ref('')
const optionKeyword = ref('')
const datePickerPlacement = ref<'left-start' | 'right-start'>('right-start')
let hidePopup: (() => void) | undefined

const column = computed(() => props.params.dataGridColumn)
const searchType = computed(() => column.value.searchType)
const filterConfig = computed(() => column.value.filter || undefined)
const operators = computed(() => getDataGridFilterOperators(column.value))
const showOperator = computed(() => operators.value.length > 1)
const options = computed(() => getColumnOptions(column.value))
const optionsLoading = computed(() => isColumnOptionsLoading(column.value))
const placeholder = computed(() => filterConfig.value?.placeholder)
const clearable = computed(() => filterConfig.value?.clearable !== false)
const showOptionSearch = computed(() => options.value.length > 6)
const filteredOptions = computed(() => {
  const keyword = optionKeyword.value.trim().toLocaleLowerCase()
  if (!keyword) {
    return options.value
  }
  return options.value.filter((option) =>
    [option.label, ...(option.aliases || [])].some((text) =>
      text.toLocaleLowerCase().includes(keyword),
    ),
  )
})
const selectedOptions = computed(() =>
  options.value.filter((option) => isOptionSelected(option.value)),
)
const dateShortcuts = computed(() => {
  if (searchType.value === 'date') {
    return [
      { key: 'today', label: '今天' },
      { key: 'yesterday', label: '昨天' },
    ]
  }
  if (searchType.value === 'datetime') {
    return [
      { key: 'now', label: '现在' },
      { key: 'todayStart', label: '今天开始' },
      { key: 'todayEnd', label: '今天结束' },
    ]
  }
  if (searchType.value === 'dateRange' || searchType.value === 'datetimeRange') {
    return [
      { key: 'today', label: '今天' },
      { key: 'yesterday', label: '昨天' },
      { key: 'last7Days', label: '近 7 天' },
      { key: 'last30Days', label: '近 30 天' },
      { key: 'thisMonth', label: '本月' },
    ]
  }
  return []
})
const textValue = computed({
  get: () => String(draftValue.value ?? ''),
  set: (value: string) => updateDraft(value),
})

const numberValue = computed({
  get: () => (typeof draftValue.value === 'number' ? draftValue.value : undefined),
  set: (value: number | undefined) => updateDraft(value),
})

const numberValueTo = computed({
  get: () => (typeof draftValueTo.value === 'number' ? draftValueTo.value : undefined),
  set: (value: number | undefined) => updateDraftValueTo(value),
})

const dateValue = computed({
  get: () => (typeof draftValue.value === 'string' ? draftValue.value : null),
  set: (value: string | null) => updateDraft(value),
})

const dateRangeValue = computed({
  get: (): [string, string] | null =>
    typeof draftValue.value === 'string' && typeof draftValueTo.value === 'string'
      ? [draftValue.value, draftValueTo.value]
      : null,
  set: (value: [string, string] | null) => {
    draftValue.value = value?.[0]
    draftValueTo.value = value?.[1]
    onDraftChange()
  },
})

function onDraftChange() {
  validationMessage.value = ''
  props.params.filterModifiedCallback()
}

function updateDraft(value: unknown) {
  draftValue.value = value
  onDraftChange()
}

function updateDraftValueTo(value: unknown) {
  draftValueTo.value = value
  onDraftChange()
}

function updateDatePickerPlacement() {
  const rect = filterRef.value?.getBoundingClientRect()
  if (!rect) {
    return
  }
  const spaceOnRight = window.innerWidth - rect.right
  datePickerPlacement.value = spaceOnRight >= rect.left ? 'right-start' : 'left-start'
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function addDays(date: Date, amount: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${formatDate(date)} ${hours}:${minutes}:${seconds}`
}

function applyDateRangeShortcut(start: Date, end: Date) {
  const isDatetimeRange = searchType.value === 'datetimeRange'
  draftValue.value = isDatetimeRange ? formatDateTime(startOfDay(start)) : formatDate(start)
  draftValueTo.value = isDatetimeRange ? formatDateTime(endOfDay(end)) : formatDate(end)
  onDraftChange()
}

function applyDateShortcut(shortcut: string) {
  const now = new Date()
  const today = startOfDay(now)
  const yesterday = addDays(today, -1)
  const isRange = searchType.value === 'dateRange' || searchType.value === 'datetimeRange'

  if (isRange) {
    if (shortcut === 'today') {
      applyDateRangeShortcut(today, today)
    } else if (shortcut === 'yesterday') {
      applyDateRangeShortcut(yesterday, yesterday)
    } else if (shortcut === 'last7Days') {
      applyDateRangeShortcut(addDays(today, -6), today)
    } else if (shortcut === 'last30Days') {
      applyDateRangeShortcut(addDays(today, -29), today)
    } else if (shortcut === 'thisMonth') {
      applyDateRangeShortcut(new Date(today.getFullYear(), today.getMonth(), 1), today)
    }
    return
  }

  if (shortcut === 'now') {
    updateDraft(formatDateTime(now))
  } else if (shortcut === 'todayStart') {
    updateDraft(formatDateTime(today))
  } else if (shortcut === 'todayEnd') {
    updateDraft(formatDateTime(endOfDay(today)))
  } else if (shortcut === 'today') {
    updateDraft(formatDate(today))
  } else if (shortcut === 'yesterday') {
    updateDraft(formatDate(yesterday))
  }
}

function selectOperator(operator: DataGridFilterOperator) {
  draftOperator.value = operator
  onDraftChange()
}

function isOptionSelected(value: unknown) {
  return searchType.value === 'multiSelect'
    ? Array.isArray(draftValue.value) && draftValue.value.some((item) => Object.is(item, value))
    : Object.is(draftValue.value, value)
}

function selectOption(value: unknown) {
  if (searchType.value === 'multiSelect') {
    const currentValues = Array.isArray(draftValue.value) ? draftValue.value : []
    draftValue.value = isOptionSelected(value)
      ? currentValues.filter((item) => !Object.is(item, value))
      : [...currentValues, value]
    onDraftChange()
    return
  }
  updateDraft(value)
}

function clearOptionSelection() {
  updateDraft(searchType.value === 'multiSelect' ? [] : undefined)
}

function removeSelectedOption(value: unknown) {
  if (searchType.value === 'multiSelect') {
    selectOption(value)
    return
  }
  clearOptionSelection()
}

function restoreDraft(model: DataGridFilterModel | null) {
  draftOperator.value = model?.operator ?? getDataGridDefaultOperator(column.value)
  draftValue.value = Array.isArray(model?.value) ? model.value.slice() : model?.value
  draftValueTo.value = model?.valueTo
  validationMessage.value = ''
  optionKeyword.value = ''
}

function createDraftModel(): DataGridFilterModel | null {
  if (!searchType.value) {
    return null
  }
  const model: DataGridFilterModel = {
    filterType: 'dataGrid',
    searchType: searchType.value,
    operator: draftOperator.value,
    value: searchType.value === 'text' ? String(draftValue.value ?? '').trim() : draftValue.value,
    valueTo: draftValueTo.value,
  }
  return isDataGridFilterModelActive(model) ? model : null
}

function confirm() {
  const model = createDraftModel()
  const message = validateDataGridFilterModel(model)
  if (message) {
    validationMessage.value = message
    return
  }
  appliedModel.value = cloneDataGridFilterModel(model)
  props.params.filterChangedCallback()
  hidePopup?.()
}

function reset() {
  appliedModel.value = null
  restoreDraft(null)
  props.params.filterChangedCallback()
  hidePopup?.()
}

function isFilterActive() {
  return isDataGridFilterModelActive(appliedModel.value)
}

function doesFilterPass(params: { node: IRowNode<DataGridRow> }) {
  return appliedModel.value
    ? doesDataGridFilterPass(appliedModel.value, props.params.getValue(params.node))
    : true
}

function getModel() {
  return cloneDataGridFilterModel(appliedModel.value)
}

function setModel(model: DataGridFilterModel | null) {
  appliedModel.value = cloneDataGridFilterModel(model)
  restoreDraft(appliedModel.value)
}

function getModelAsString(model?: DataGridFilterModel | null) {
  return getDataGridFilterModelText(model ?? appliedModel.value, column.value)
}

function shouldAutoFocusControl() {
  const isDateFilter = dateShortcuts.value.length > 0
  return !isDateFilter || !isDataGridFilterModelActive(appliedModel.value)
}

function afterGuiAttached(params?: IAfterGuiAttachedParams) {
  hidePopup = params?.hidePopup
  restoreDraft(appliedModel.value)
  if (!params?.suppressFocus && shouldAutoFocusControl()) {
    nextTick(() => controlRef.value?.focus?.())
  }
}

function afterGuiDetached() {
  restoreDraft(appliedModel.value)
  hidePopup = undefined
}

defineExpose({
  isFilterActive,
  doesFilterPass,
  getModel,
  setModel,
  getModelAsString,
  afterGuiAttached,
  afterGuiDetached,
})
</script>

<template>
  <div
    ref="filterRef"
    class="data-grid-filter"
    :class="{ 'data-grid-filter--datetime-range': searchType === 'datetimeRange' }"
    @mousedown.stop
    @click.stop
  >
    <div v-if="showOperator" class="data-grid-filter__section">
      <div class="data-grid-filter__section-title">比较方式</div>
      <div class="data-grid-filter__operator-list">
        <button
          v-for="operator in operators"
          :key="operator"
          type="button"
          class="data-grid-filter__choice"
          :class="{ 'is-active': draftOperator === operator }"
          :aria-pressed="draftOperator === operator"
          @click="selectOperator(operator)"
        >
          {{ getDataGridOperatorLabel(operator, searchType!) }}
        </button>
      </div>
    </div>

    <div v-if="dateShortcuts.length" class="data-grid-filter__shortcut">
      <div class="data-grid-filter__section-title">快捷选择</div>
      <div class="data-grid-filter__shortcut-list">
        <button
          v-for="shortcut in dateShortcuts"
          :key="shortcut.key"
          type="button"
          class="data-grid-filter__choice"
          @click="applyDateShortcut(shortcut.key)"
        >
          {{ shortcut.label }}
        </button>
      </div>
    </div>

    <el-input
      v-if="searchType === 'text'"
      ref="controlRef"
      v-model="textValue"
      class="data-grid-filter__control"
      :placeholder="placeholder || '请输入筛选内容'"
      :clearable="clearable"
      @keydown.enter.stop.prevent="confirm"
    />

    <el-input-number
      v-else-if="searchType === 'number'"
      ref="controlRef"
      v-model="numberValue"
      class="data-grid-filter__control"
      :placeholder="placeholder || '请输入数值'"
      :controls="false"
      @keydown.enter.stop.prevent="confirm"
    />

    <div v-else-if="searchType === 'numberRange'" class="data-grid-filter__range">
      <el-input-number
        ref="controlRef"
        v-model="numberValue"
        class="data-grid-filter__range-control"
        placeholder="最小值"
        :controls="false"
      />
      <span class="data-grid-filter__range-separator">至</span>
      <el-input-number
        v-model="numberValueTo"
        class="data-grid-filter__range-control"
        placeholder="最大值"
        :controls="false"
      />
    </div>

    <el-date-picker
      v-else-if="searchType === 'date' || searchType === 'datetime'"
      ref="controlRef"
      v-model="dateValue"
      class="data-grid-filter__control"
      :type="searchType"
      :format="searchType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
      :value-format="searchType === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'"
      :placeholder="placeholder || (searchType === 'datetime' ? '请选择日期时间' : '请选择日期')"
      :clearable="clearable"
      :placement="datePickerPlacement"
      :popper-options="DATE_PICKER_POPPER_OPTIONS"
      popper-class="ag-custom-component-popup data-grid-filter__picker-popper"
      @mousedown="updateDatePickerPlacement"
    />

    <el-date-picker
      v-else-if="searchType === 'dateRange'"
      ref="controlRef"
      v-model="dateRangeValue"
      class="data-grid-filter__control"
      type="daterange"
      format="YYYY-MM-DD"
      value-format="YYYY-MM-DD"
      :clearable="clearable"
      start-placeholder="开始"
      end-placeholder="结束"
      :placement="datePickerPlacement"
      :popper-options="DATE_PICKER_POPPER_OPTIONS"
      popper-class="ag-custom-component-popup data-grid-filter__picker-popper"
      @mousedown="updateDatePickerPlacement"
    />

    <el-date-picker
      v-else-if="searchType === 'datetimeRange'"
      ref="controlRef"
      v-model="dateRangeValue"
      class="data-grid-filter__control"
      type="datetimerange"
      format="YYYY-MM-DD HH:mm:ss"
      value-format="YYYY-MM-DD HH:mm:ss"
      :default-time="DATETIME_RANGE_DEFAULT_TIME"
      :clearable="clearable"
      range-separator="至"
      start-placeholder="开始时间"
      end-placeholder="结束时间"
      :placement="datePickerPlacement"
      :popper-options="DATE_PICKER_POPPER_OPTIONS"
      popper-class="ag-custom-component-popup data-grid-filter__picker-popper"
      @mousedown="updateDatePickerPlacement"
    />

    <div
      v-else-if="searchType === 'select' || searchType === 'multiSelect'"
      ref="controlRef"
      class="data-grid-filter__section"
      tabindex="-1"
    >
      <div class="data-grid-filter__section-header">
        <div class="data-grid-filter__section-heading">
          <span class="data-grid-filter__section-title">{{
            searchType === 'multiSelect' ? '可多选' : '请选择'
          }}</span>
          <span class="data-grid-filter__section-count">
            {{
              optionKeyword
                ? `${filteredOptions.length}/${options.length} 项`
                : `${options.length} 项${selectedOptions.length ? `，已选 ${selectedOptions.length}` : ''}`
            }}
          </span>
        </div>
        <button
          v-if="clearable && isDataGridFilterModelActive(createDraftModel())"
          type="button"
          class="data-grid-filter__clear"
          @click="clearOptionSelection"
        >
          清除选择
        </button>
      </div>

      <el-input
        v-if="showOptionSearch"
        v-model="optionKeyword"
        class="data-grid-filter__option-search"
        :placeholder="placeholder || '搜索选项'"
        clearable
      />

      <div v-if="showOptionSearch && selectedOptions.length" class="data-grid-filter__selected">
        <div class="data-grid-filter__selected-title">当前选择</div>
        <div class="data-grid-filter__selected-list">
          <span
            v-for="option in selectedOptions"
            :key="`${typeof option.value}:${String(option.value)}`"
            class="data-grid-filter__selected-item"
          >
            <span class="data-grid-filter__selected-label" :title="option.label">{{
              option.label
            }}</span>
            <button
              type="button"
              class="data-grid-filter__selected-remove"
              :aria-label="`移除${option.label}`"
              @click="removeSelectedOption(option.value)"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <div class="data-grid-filter__option-list" :aria-busy="optionsLoading">
        <div v-if="optionsLoading" class="data-grid-filter__option-state">选项加载中…</div>
        <button
          v-for="option in optionsLoading ? [] : filteredOptions"
          :key="`${typeof option.value}:${String(option.value)}`"
          type="button"
          class="data-grid-filter__option"
          :class="{ 'is-active': isOptionSelected(option.value) }"
          :disabled="option.disabled"
          :aria-pressed="isOptionSelected(option.value)"
          @click="selectOption(option.value)"
        >
          <span class="data-grid-filter__option-mark">{{
            isOptionSelected(option.value) ? '✓' : ''
          }}</span>
          <span class="data-grid-filter__option-label">{{ option.label }}</span>
        </button>
        <div
          v-if="!optionsLoading && !filteredOptions.length"
          class="data-grid-filter__option-state"
        >
          暂无匹配选项
        </div>
      </div>
    </div>

    <div
      v-else-if="searchType === 'boolean'"
      ref="controlRef"
      class="data-grid-filter__section"
      tabindex="-1"
    >
      <div class="data-grid-filter__section-title">请选择</div>
      <div class="data-grid-filter__boolean-list">
        <button
          v-if="clearable"
          type="button"
          class="data-grid-filter__choice"
          :class="{ 'is-active': draftValue === undefined }"
          :aria-pressed="draftValue === undefined"
          @click="clearOptionSelection"
        >
          不限
        </button>
        <button
          v-for="option in [
            { label: '是', value: true },
            { label: '否', value: false },
          ]"
          :key="String(option.value)"
          type="button"
          class="data-grid-filter__choice"
          :class="{ 'is-active': Object.is(draftValue, option.value) }"
          :aria-pressed="Object.is(draftValue, option.value)"
          @click="selectOption(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="validationMessage" class="data-grid-filter__error">
      {{ validationMessage }}
    </div>

    <div class="data-grid-filter__footer">
      <div class="data-grid-filter__footer-actions">
        <el-button size="small" @click="reset">重置</el-button>
        <el-button size="small" type="primary" :disabled="optionsLoading" @click="confirm"
          >确认</el-button
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.data-grid-filter {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 320px;
  max-width: calc(100vw - 32px);
  max-height: min(480px, calc(100vh - 32px));
  padding: 12px;
  overflow-y: auto;

  &.data-grid-filter--datetime-range {
    /* 日期时间范围需要完整展示两个包含时分秒的值，因此仅扩大该类型的筛选宽度。 */
    width: 480px;
  }

  .data-grid-filter__control {
    width: 100%;
  }

  .data-grid-filter__shortcut {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .data-grid-filter__shortcut-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .data-grid-filter__section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    padding: 10px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .data-grid-filter__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 20px;
  }

  .data-grid-filter__section-title {
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: var(--el-text-color-primary);
  }

  .data-grid-filter__section-heading {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }

  .data-grid-filter__section-count {
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-placeholder);
  }

  .data-grid-filter__operator-list,
  .data-grid-filter__boolean-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .data-grid-filter__choice {
    min-width: 56px;
    padding: 5px 12px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    transition:
      color 0.15s ease,
      background-color 0.15s ease,
      border-color 0.15s ease;

    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary-light-5);
    }

    &.is-active {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-5);
      outline-offset: 1px;
    }
  }

  .data-grid-filter__clear {
    padding: 0;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-color-primary);
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover {
      color: var(--el-color-primary-dark-2);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-5);
      outline-offset: 2px;
    }
  }

  .data-grid-filter__option-search {
    width: 100%;
  }

  .data-grid-filter__selected {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .data-grid-filter__selected-title {
    font-size: 12px;
    line-height: 18px;
    color: var(--el-text-color-secondary);
  }

  .data-grid-filter__selected-list {
    /*
		 * 大量多选时限制已选标签区域高度，避免已选内容挤压搜索结果和底部操作区；
		 * 用户仍可在区域内滚动查看并逐项移除。
		 */
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-height: 70px;
    overflow-y: auto;
  }

  .data-grid-filter__selected-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    padding: 3px 5px 3px 8px;
    font-size: 12px;
    line-height: 18px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary-light-7);
    border-radius: 4px;
  }

  .data-grid-filter__selected-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .data-grid-filter__selected-remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
    color: var(--el-color-primary);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 50%;

    &:hover {
      background: var(--el-color-primary-light-8);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-5);
      outline-offset: 1px;
    }
  }

  .data-grid-filter__option-list {
    /* 选项在筛选浮层内部滚动，避免大量字典项把底部操作区推出视口。 */
    display: flex;
    flex-direction: column;
    max-height: 216px;
    padding: 4px;
    overflow-y: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  .data-grid-filter__option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 7px 8px;
    color: var(--el-text-color-regular);
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 4px;

    &:hover:not(:disabled) {
      background: var(--el-fill-color-light);
    }

    &.is-active {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
    }

    &:focus-visible {
      outline: 2px solid var(--el-color-primary-light-5);
      outline-offset: -2px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .data-grid-filter__option-mark {
    flex: none;
    width: 16px;
    color: var(--el-color-primary);
    text-align: center;
  }

  .data-grid-filter__option-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .data-grid-filter__option-state {
    padding: 20px 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }

  .data-grid-filter__range {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .data-grid-filter__range-control {
    flex: 1;
    min-width: 0;
  }

  .data-grid-filter__range-separator {
    flex: none;
    color: var(--el-text-color-secondary);
  }

  .data-grid-filter__error {
    font-size: 12px;
    line-height: 18px;
    color: var(--el-color-danger);
  }

  .data-grid-filter__footer {
    /*
		 * 所有筛选类型统一使用底部吸附操作栏，保持操作位置稳定；
		 * 日期面板根据可用空间从筛选器侧面展开，不与操作栏争夺垂直空间。
		 */
    position: sticky;
    bottom: -12px;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 0 12px;
    margin-bottom: -12px;
    //background: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-lighter);

    .el-button + .el-button {
      margin-left: 0;
    }
  }

  .data-grid-filter__footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

/*
 * Element Plus 2.3 的日期 Popper 会传送到 body，无法嵌套在组件根类中；
 * 关闭时立即隐藏离场节点，避免定位引用销毁后弹层短暂闪到页面左上角。
 */
.data-grid-filter__picker-popper.el-zoom-in-top-leave-active {
  visibility: hidden;
  transition: none;
}
</style>
