import { unref } from 'vue'
import type {
  DataGridColumn,
  DataGridOption,
  DataGridOptionsSource,
  DataGridReactiveValue,
  DataGridRow,
} from './types'

export function resolveReactiveValue<T>(
  value: DataGridReactiveValue<T> | undefined,
  fallback: T,
): T {
  return value === undefined ? fallback : unref(value)
}

export function resolveOptions(source?: DataGridOptionsSource): readonly DataGridOption[] {
  return source ? unref(source) : []
}

export function getColumnOptions<Row extends DataGridRow>(column: DataGridColumn<Row>) {
  return resolveOptions(column.options)
}

export function isColumnOptionsLoading<Row extends DataGridRow>(column: DataGridColumn<Row>) {
  return resolveReactiveValue(column.optionsLoading, false)
}

export function findOptionByValue(options: readonly DataGridOption[], value: unknown) {
  return options.find((option) => Object.is(option.value, value))
}

export function formatOptionValue(options: readonly DataGridOption[], value: unknown) {
  return findOptionByValue(options, value)?.label
}

function normalizeMatchText(text: string, trim: boolean, ignoreCase: boolean) {
  let result = trim ? text.trim() : text
  if (ignoreCase) {
    result = result.toLocaleLowerCase()
  }
  return result
}

export function matchOptionText(
  options: readonly DataGridOption[],
  text: string,
  config: { trim?: boolean; ignoreCase?: boolean } = {},
) {
  const trim = config.trim !== false
  const ignoreCase = config.ignoreCase === true
  const target = normalizeMatchText(text, trim, ignoreCase)
  const matches = options.filter((option) => {
    const candidates = [option.label, String(option.value), ...(option.aliases || [])]
    return candidates.some(
      (candidate) => normalizeMatchText(candidate, trim, ignoreCase) === target,
    )
  })
  if (matches.length > 1) {
    throw new Error(`选项匹配不唯一：${text}`)
  }
  if (!matches.length) {
    throw new Error(`选项值不存在：${text}`)
  }
  if (matches[0].disabled) {
    throw new Error(`选项已禁用：${matches[0].label}`)
  }
  return matches[0]
}
