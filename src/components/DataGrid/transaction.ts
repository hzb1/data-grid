/**
 * 工具名称：DataGrid 行数据事务
 * 使用场景：以纯函数计算编辑或粘贴产生的候选行、字段差异和整批回滚结果。
 */

import { getColumnOptions } from './options'
import type {
  DataGridChangeSource,
  DataGridClipboardError,
  DataGridColumn,
  DataGridRow,
  DataGridRowChangeContext,
  DataGridRowKey,
  DataGridValueChange,
} from './types'
import { getFieldValue, setFieldValue } from './utils'

/** DataGrid 在提交前暂存的单个字段变化。 */
export interface DataGridPendingChange {
  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 本次变化对应的业务字段。 */
  field: string

  /** 解析和标准化后的目标值。 */
  newValue: unknown

  /** 粘贴来源的原始文本，编辑事务可以不提供。 */
  text?: string

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex?: number
}

/** DataGrid 行事务需要的业务配置和回调。 */
export interface DataGridRowTransactionOptions<Row extends DataGridRow> {
  /** 当前表格声明的全部业务列。 */
  columns: DataGridColumn<Row>[]

  /** 返回业务行的稳定唯一标识。 */
  getRowKey: (row: Row, dataIndex: number) => DataGridRowKey

  /** 单行字段变化后计算派生字段的业务回调。 */
  processRowChange?: (row: Row, context: DataGridRowChangeContext<Row>) => Row
}

/** DataGrid 一次纯行事务的计算结果。 */
export interface DataGridRowTransactionResult<Row extends DataGridRow> {
  /** 事务成功后的完整行数组；失败时保持原数组引用。 */
  rows: Row[]

  /** 事务实际产生的全部字段差异。 */
  changes: DataGridValueChange<Row>[]

  /** 行业务处理失败时产生的错误。 */
  errors: DataGridClipboardError<Row>[]
}

/** 根据字段变化生成包含选项映射和派生字段的候选行。 */
export function createDataGridCandidateRow<Row extends DataGridRow>(
  previousRow: Row,
  rowChanges: DataGridPendingChange[],
  source: Extract<DataGridChangeSource, 'edit' | 'paste'>,
  dataIndex: number,
  options: DataGridRowTransactionOptions<Row>,
) {
  let row = rowChanges.reduce(
    (result, change) => setFieldValue(result, change.field, change.newValue),
    previousRow,
  )
  rowChanges.forEach((change) => {
    const column = options.columns.find((item) => item.field === change.field)
    if (!column?.options || !column.optionMapping) {
      return
    }
    const option = getColumnOptions(column).find((item) => Object.is(item.value, change.newValue))
    row = setFieldValue(
      row,
      column.optionMapping.labelField,
      change.newValue === null || change.newValue === '' ? '' : (option?.label ?? ''),
    )
  })
  if (options.processRowChange) {
    row = options.processRowChange(row, {
      source,
      dataIndex,
      changedFields: [
        ...new Set(rowChanges.map((change) => change.field)),
      ] as DataGridValueChange<Row>['field'][],
      previousRow,
    })
  }
  return row
}

/** 比较事务前后业务行并返回列字段及选项标签字段的差异。 */
export function createDataGridValueChanges<Row extends DataGridRow>(
  previousRow: Row,
  row: Row,
  dataIndex: number,
  options: DataGridRowTransactionOptions<Row>,
) {
  const rowKey = options.getRowKey(previousRow, dataIndex)
  const fields = new Set<string>()
  options.columns.forEach((column) => {
    fields.add(column.field)
    if (column.optionMapping) {
      fields.add(column.optionMapping.labelField)
    }
  })
  return [...fields].flatMap<DataGridValueChange<Row>>((field) => {
    const oldValue = getFieldValue(previousRow, field)
    const newValue = getFieldValue(row, field)
    return Object.is(oldValue, newValue)
      ? []
      : [
          {
            rowKey,
            dataIndex,
            field: field as DataGridValueChange<Row>['field'],
            oldValue,
            newValue,
            row,
          },
        ]
  })
}

/** 原子计算整批行变化，任意行业务处理失败时回滚全部结果。 */
export function applyDataGridRowTransaction<Row extends DataGridRow>(
  baseRows: Row[],
  pendingChanges: DataGridPendingChange[],
  source: Extract<DataGridChangeSource, 'edit' | 'paste'>,
  options: DataGridRowTransactionOptions<Row>,
): DataGridRowTransactionResult<Row> {
  const changesByRow = new Map<number, DataGridPendingChange[]>()
  pendingChanges.forEach((change) => {
    const rowChanges = changesByRow.get(change.dataIndex) ?? []
    rowChanges.push(change)
    changesByRow.set(change.dataIndex, rowChanges)
  })
  const rows = baseRows.slice()
  const valueChanges: DataGridValueChange<Row>[] = []
  const errors: DataGridClipboardError<Row>[] = []

  changesByRow.forEach((rowChanges, dataIndex) => {
    const previousRow = baseRows[dataIndex]
    if (!previousRow) {
      return
    }
    try {
      const row = createDataGridCandidateRow(previousRow, rowChanges, source, dataIndex, options)
      rows[dataIndex] = row
      valueChanges.push(...createDataGridValueChanges(previousRow, row, dataIndex, options))
    } catch (error) {
      const change = rowChanges[0]
      errors.push({
        displayIndex: change.displayIndex ?? dataIndex,
        field: change.field as DataGridClipboardError<Row>['field'],
        columnTitle:
          options.columns.find((column) => column.field === change.field)?.title ?? change.field,
        text: change.text ?? '',
        message: error instanceof Error ? error.message : '行业务处理失败',
        row: previousRow,
      })
    }
  })

  return errors.length
    ? { rows: baseRows, changes: [], errors }
    : {
        rows,
        changes: valueChanges,
        errors,
      }
}
