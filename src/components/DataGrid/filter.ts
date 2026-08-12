import { findOptionByValue, getColumnOptions } from './options'
import type {
  DataGridColumn,
  DataGridDateOperator,
  DataGridFilterModel,
  DataGridFilterOperator,
  DataGridNumberOperator,
  DataGridRow,
  DataGridSearchType,
  DataGridTextOperator,
} from './types'

const TEXT_OPERATORS: readonly DataGridTextOperator[] = [
  'contains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
]

const NUMBER_OPERATORS: readonly DataGridNumberOperator[] = [
  'equals',
  'notEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]

const DEFAULT_OPERATOR_MAP: Record<DataGridSearchType, DataGridFilterOperator> = {
  text: 'contains',
  number: 'equals',
  numberRange: 'inRange',
  date: 'equals',
  dateRange: 'inRange',
  datetime: 'equals',
  datetimeRange: 'inRange',
  select: 'equals',
  multiSelect: 'in',
  boolean: 'equals',
}

export const DATA_GRID_OPERATOR_LABELS: Record<DataGridFilterOperator, string> = {
  contains: '包含',
  equals: '等于',
  notEqual: '不等于',
  startsWith: '开头是',
  endsWith: '结尾是',
  greaterThan: '大于',
  greaterThanOrEqual: '大于等于',
  lessThan: '小于',
  lessThanOrEqual: '小于等于',
  inRange: '范围内',
  in: '包含任一项',
}

const DATE_OPERATOR_LABELS: Partial<Record<DataGridFilterOperator, string>> = {
  greaterThan: '晚于',
  greaterThanOrEqual: '不早于',
  lessThan: '早于',
  lessThanOrEqual: '不晚于',
}

export function getDataGridOperatorLabel(
  operator: DataGridFilterOperator,
  searchType: DataGridSearchType,
) {
  return searchType === 'date' || searchType === 'datetime'
    ? DATE_OPERATOR_LABELS[operator] || DATA_GRID_OPERATOR_LABELS[operator]
    : DATA_GRID_OPERATOR_LABELS[operator]
}

function getConfiguredOperators(column: DataGridColumn): DataGridFilterOperator[] | undefined {
  if (!column.filter || !('operators' in column.filter)) {
    return
  }
  return column.filter.operators as DataGridFilterOperator[] | undefined
}

export function getDataGridFilterOperators(column: DataGridColumn) {
  const searchType = column.searchType
  if (!searchType) {
    return []
  }
  const supported =
    searchType === 'text'
      ? TEXT_OPERATORS
      : searchType === 'number' || searchType === 'date' || searchType === 'datetime'
        ? NUMBER_OPERATORS
        : [DEFAULT_OPERATOR_MAP[searchType]]
  const configured = getConfiguredOperators(column)
  if (!configured) {
    return [...supported]
  }
  if (!configured.length) {
    return [DEFAULT_OPERATOR_MAP[searchType]]
  }
  const operators = configured.filter((operator) => supported.includes(operator as never))
  return operators.length ? operators : [DEFAULT_OPERATOR_MAP[searchType]]
}

export function getDataGridDefaultOperator(column: DataGridColumn) {
  const operators = getDataGridFilterOperators(column)
  const configured =
    column.filter && 'defaultOperator' in column.filter ? column.filter.defaultOperator : undefined
  if (configured && operators.includes(configured)) {
    return configured
  }
  return operators[0] || (column.searchType ? DEFAULT_OPERATOR_MAP[column.searchType] : 'equals')
}

export function cloneDataGridFilterModel(model: DataGridFilterModel | null) {
  if (!model) {
    return null
  }
  return {
    ...model,
    value: Array.isArray(model.value) ? model.value.slice() : model.value,
  }
}

function hasScalarValue(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

export function isDataGridFilterModelActive(model: DataGridFilterModel | null) {
  if (!model) {
    return false
  }
  if (model.searchType === 'multiSelect') {
    return Array.isArray(model.value) && model.value.length > 0
  }
  if (model.searchType === 'numberRange') {
    return hasScalarValue(model.value) || hasScalarValue(model.valueTo)
  }
  if (model.searchType === 'dateRange' || model.searchType === 'datetimeRange') {
    return hasScalarValue(model.value) && hasScalarValue(model.valueTo)
  }
  return hasScalarValue(model.value)
}

export function validateDataGridFilterModel(model: DataGridFilterModel | null) {
  if (!model || !isDataGridFilterModelActive(model)) {
    return
  }
  if (model.searchType === 'numberRange') {
    const min = hasScalarValue(model.value) ? Number(model.value) : undefined
    const max = hasScalarValue(model.valueTo) ? Number(model.valueTo) : undefined
    if (min !== undefined && max !== undefined && min > max) {
      return '最小值不能大于最大值'
    }
  }
  if (model.searchType === 'dateRange' || model.searchType === 'datetimeRange') {
    if (!hasScalarValue(model.value) || !hasScalarValue(model.valueTo)) {
      return '请选择完整的开始和结束时间'
    }
    if (toDateTime(model.value) > toDateTime(model.valueTo)) {
      return '开始时间不能晚于结束时间'
    }
  }
}

function compareScalar(
  value: string | number,
  target: string | number,
  operator: DataGridFilterOperator,
) {
  if (operator === 'equals') {
    return value === target
  }
  if (operator === 'notEqual') {
    return value !== target
  }
  if (operator === 'greaterThan') {
    return value > target
  }
  if (operator === 'greaterThanOrEqual') {
    return value >= target
  }
  if (operator === 'lessThan') {
    return value < target
  }
  if (operator === 'lessThanOrEqual') {
    return value <= target
  }
  return false
}

function toDateTime(value: unknown) {
  const time = new Date(String(value ?? '')).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

export function doesDataGridFilterPass(model: DataGridFilterModel, cellValue: unknown) {
  if (model.searchType === 'text') {
    const value = String(cellValue ?? '').toLocaleLowerCase()
    const target = String(model.value ?? '')
      .trim()
      .toLocaleLowerCase()
    if (model.operator === 'contains') {
      return value.includes(target)
    }
    if (model.operator === 'startsWith') {
      return value.startsWith(target)
    }
    if (model.operator === 'endsWith') {
      return value.endsWith(target)
    }
    return compareScalar(value, target, model.operator)
  }
  if (model.searchType === 'number') {
    const value = Number(cellValue)
    const target = Number(model.value)
    return (
      Number.isFinite(value) &&
      Number.isFinite(target) &&
      compareScalar(value, target, model.operator)
    )
  }
  if (model.searchType === 'numberRange') {
    const value = Number(cellValue)
    const min = hasScalarValue(model.value) ? Number(model.value) : undefined
    const max = hasScalarValue(model.valueTo) ? Number(model.valueTo) : undefined
    return (
      Number.isFinite(value) &&
      (min === undefined || value >= min) &&
      (max === undefined || value <= max)
    )
  }
  if (model.searchType === 'date' || model.searchType === 'datetime') {
    return compareScalar(toDateTime(cellValue), toDateTime(model.value), model.operator)
  }
  if (model.searchType === 'dateRange' || model.searchType === 'datetimeRange') {
    const value = toDateTime(cellValue)
    return value >= toDateTime(model.value) && value <= toDateTime(model.valueTo)
  }
  if (model.searchType === 'multiSelect') {
    return Array.isArray(model.value) && model.value.some((item) => Object.is(item, cellValue))
  }
  if (model.searchType === 'select' || model.searchType === 'boolean') {
    return Object.is(model.value, cellValue)
  }
  return true
}

export function getDataGridFilterModelText(
  model: DataGridFilterModel | null,
  column: DataGridColumn<DataGridRow>,
) {
  if (!model) {
    return ''
  }
  if (model.searchType === 'multiSelect') {
    return (Array.isArray(model.value) ? model.value : [])
      .map((value) => findOptionByValue(getColumnOptions(column), value)?.label ?? String(value))
      .join('、')
  }
  if (model.searchType === 'select') {
    return (
      findOptionByValue(getColumnOptions(column), model.value)?.label ?? String(model.value ?? '')
    )
  }
  if (model.searchType === 'boolean') {
    return model.value ? '是' : '否'
  }
  if (
    model.searchType === 'numberRange' ||
    model.searchType === 'dateRange' ||
    model.searchType === 'datetimeRange'
  ) {
    return `${model.value ?? ''} 至 ${model.valueTo ?? ''}`
  }
  return `${getDataGridOperatorLabel(model.operator, model.searchType)} ${String(model.value ?? '')}`
}

export type { DataGridDateOperator, DataGridNumberOperator, DataGridTextOperator }
