import Big from 'big.js'
import type { FilterModel } from 'ag-grid-community'
import type {
  DataGridColumn,
  DataGridEditorConfig,
  DataGridEditorContext,
  DataGridFilterItem,
  DataGridFilterOperator,
  DataGridRow,
  DataGridSummaryConfig,
  DataGridSummaryValue,
} from './types'

/** 深拷贝 DataGrid 复制行使用的普通业务数据。 */
export function cloneDataGridRow<Row extends DataGridRow>(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => {
      if (Array.isArray(value)) {
        return [
          field,
          value.map((item) =>
            item && typeof item === 'object' ? cloneDataGridRow(item as DataGridRow) : item,
          ),
        ]
      }
      return [
        field,
        value && typeof value === 'object' ? cloneDataGridRow(value as DataGridRow) : value,
      ]
    }),
  ) as Row
}

const SUPPORTED_FILTER_OPERATORS = new Set<DataGridFilterOperator>([
  'contains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'inRange',
  'in',
])

export function getFieldValue(row: DataGridRow, field: string): unknown {
  return field.split('.').reduce<unknown>((target, key) => {
    if (!target || typeof target !== 'object') {
      return undefined
    }
    return (target as DataGridRow)[key]
  }, row)
}

export function setFieldValue<Row extends DataGridRow>(
  row: Row,
  field: string,
  value: unknown,
): Row {
  const keys = field.split('.')
  const result = { ...row }
  let source: DataGridRow = row
  let target: DataGridRow = result

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      target[key] = value
      return
    }
    const sourceChild = source[key]
    const targetChild =
      sourceChild && typeof sourceChild === 'object' ? { ...(sourceChild as DataGridRow) } : {}
    target[key] = targetChild
    source = (sourceChild as DataGridRow) || {}
    target = targetChild
  })

  return result
}

/**
 * 将表格编辑或剪贴板中的数字转换成 number。
 * 支持 Excel/WPS 常见的英文千分位格式，例如 1,234.56。
 */
export function parseDataGridNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const text = String(value).trim()
  const isValidNumber = /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)
  if (!isValidNumber) {
    return null
  }
  const numberValue = Number(text.replaceAll(',', ''))
  return Number.isFinite(numberValue) ? numberValue : null
}

/** 解析当前单元格需要透传给编辑控件的静态或动态属性。 */
export function resolveEditorComponentProps<Row>(
  editor: DataGridEditorConfig<Row>,
  context: DataGridEditorContext<Row>,
): Record<string, unknown> {
  const source =
    typeof editor.componentProps === 'function'
      ? editor.componentProps(context)
      : editor.componentProps
  return (source || {}) as Record<string, unknown>
}

export function normalizeEditorValue<Row>(
  value: unknown,
  editor?: false | DataGridEditorConfig<Row>,
  context?: DataGridEditorContext<Row>,
) {
  if (!editor) {
    return value
  }
  const componentProps = (
    context === undefined
      ? typeof editor.componentProps === 'function'
        ? {}
        : editor.componentProps || {}
      : resolveEditorComponentProps(editor, context)
  ) as Record<string, unknown>
  if (editor.type === 'text' || editor.type === 'textarea') {
    const text = String(value ?? '')
    const maxLength = Number(componentProps.maxlength)
    return Number.isFinite(maxLength) ? text.slice(0, maxLength) : text
  }
  if (editor.type === 'number') {
    if (value === '' || value === null || value === undefined) {
      return null
    }
    let numberValue = parseDataGridNumber(value)
    if (numberValue === null) {
      return null
    }
    const min = Number(componentProps.min)
    const max = Number(componentProps.max)
    const precision = Number(componentProps.precision)
    if (Number.isFinite(min)) {
      numberValue = Math.max(min, numberValue)
    }
    if (Number.isFinite(max)) {
      numberValue = Math.min(max, numberValue)
    }
    if (Number.isFinite(precision)) {
      numberValue = Number(new Big(numberValue).toFixed(precision))
    }
    return numberValue
  }
  return value
}

export function convertFilterModel(model: FilterModel | null | undefined): DataGridFilterItem[] {
  if (!model) {
    return []
  }
  return Object.entries(model).flatMap(([field, item]) => {
    if (item?.filterType !== 'dataGrid' || !SUPPORTED_FILTER_OPERATORS.has(item.operator)) {
      return []
    }
    return [
      {
        field,
        operator: item.operator,
        value: item.value,
        valueTo: item.valueTo,
      },
    ]
  })
}

function toNumericValues<Row extends DataGridRow>(rows: Row[], column: DataGridColumn<Row>) {
  const summary = column.summary || undefined
  return rows
    .map((row) => summary?.valueGetter?.(row) ?? Number(getFieldValue(row, column.field)))
    .filter((value) => Number.isFinite(value))
}

function aggregate<Row extends DataGridRow>(
  rows: Row[],
  column: DataGridColumn<Row>,
  summaryRow: Row,
) {
  const summary = column.summary || undefined
  if (!summary) {
    return ''
  }
  let value: DataGridSummaryValue
  if (summary.method === 'custom') {
    value = summary.custom?.(rows) ?? ''
  } else if (summary.method === 'count') {
    value = rows.length
  } else {
    const values = toNumericValues(rows, column)
    if (!values.length) {
      return ''
    }
    if (summary.method === 'min') {
      value = Math.min(...values)
    } else if (summary.method === 'max') {
      value = Math.max(...values)
    } else {
      const total = values.reduce((result, item) => result.plus(item), new Big(0))
      value = summary.method === 'avg' ? total.div(values.length).toString() : total.toString()
    }
    if (typeof summary.precision === 'number') {
      value = new Big(value).toFixed(summary.precision)
    }
  }
  const summaryValue = summary.formatter?.(value, rows)
  if (summaryValue !== undefined && summaryValue !== null) {
    return summaryValue
  }
  if (Array.isArray(value)) {
    return value
  }
  return column.formatter?.(value, summaryRow, -1) ?? value
}

export function createSummaryRow<Row extends DataGridRow>(
  rows: Row[],
  columns: DataGridColumn<Row>[],
  config: DataGridSummaryConfig,
  labelField?: string,
): Row {
  const result: DataGridRow = {}
  const visibleColumns = columns.filter((column) => column.initialVisible !== false)
  const resolvedLabelField = labelField || visibleColumns[0]?.field
  if (resolvedLabelField) {
    result[resolvedLabelField] = config.label || '合计'
  }
  for (const column of visibleColumns) {
    if (column.summary) {
      result[column.field] = aggregate(rows, column, result as Row)
    }
  }
  return result as Row
}
