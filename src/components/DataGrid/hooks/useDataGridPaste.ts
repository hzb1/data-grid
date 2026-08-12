/**
 * 组合函数名称：DataGrid 批量粘贴
 * 使用场景：处理矩形选区粘贴、追加行、业务校验、错误策略、异步取消和最终事务提交。
 */

import type { GridApi } from 'ag-grid-community'
import { onBeforeUnmount } from 'vue'
import { createDataGridPasteTransactionManager, parseClipboardText } from '../clipboard'
import { encodeDataGridRowKey } from '../rowKey'
import type { DataGridPendingChange } from '../transaction'
import type {
  DataGridClipboardConfig,
  DataGridClipboardError,
  DataGridClipboardPastePayload,
  DataGridCellLoadingTask,
  DataGridColumn,
  DataGridField,
  DataGridMode,
  DataGridRow,
  DataGridRowKey,
  DataGridSelectionRange,
  DataGridValidationError,
  DataGridValueChange,
} from '../types'
import { getColumnOptions, isColumnOptionsLoading, matchOptionText } from '../options'
import { getFieldValue, normalizeEditorValue, parseDataGridNumber } from '../utils'
import type { DataGridSelectionBounds, DataGridSelectionPoint } from './useDataGridSelection'
import type { DataGridValidateRowRequest } from './useDataGridValidation'

/** DataGrid 粘贴流程使用的校验管理器最小接口。 */
interface DataGridPasteValidationManager<Row extends DataGridRow> {
  /** 取消当前表格全部异步校验。 */
  abortAll: () => void

  /** 返回当前表格保存的校验错误。 */
  getErrors: () => DataGridValidationError<Row>[]

  /** 用完整错误列表替换当前校验状态。 */
  setErrors: (errors: DataGridValidationError<Row>[]) => void

  /** 校验一条尚未提交的候选业务行。 */
  validateCandidate: (
    request: DataGridValidateRowRequest<Row>,
  ) => Promise<DataGridValidationError<Row>[]>
}

/** DataGrid 粘贴提交回调的结果。 */
interface DataGridPasteCommitResult<Row extends DataGridRow> {
  /** 本次提交实际产生的字段差异。 */
  changes: DataGridValueChange<Row>[]

  /** 本次提交成功追加的业务行。 */
  appendedRows: Row[]

  /** 行业务处理失败时返回的错误。 */
  errors: DataGridClipboardError<Row>[]
}

/** DataGrid 粘贴流程主动反馈的消息级别。 */
type DataGridPasteFeedbackLevel = 'info' | 'warning'

/** DataGrid 批量粘贴组合函数参数。 */
interface UseDataGridPasteOptions<Row extends DataGridRow> {
  /** 返回当前 AG Grid 实例。 */
  getApi: () => GridApi<Row> | undefined

  /** 返回当前矩形选区边界。 */
  getBounds: () => DataGridSelectionBounds | undefined

  /** 返回当前公开的矩形选区。 */
  getSelectionRange: () => DataGridSelectionRange | undefined

  /** 将指定起止坐标设置为当前矩形选区。 */
  selectRange: (start: DataGridSelectionPoint, end: DataGridSelectionPoint) => void

  /** 返回当前表级剪贴板配置。 */
  getConfig: () => false | DataGridClipboardConfig<Row>

  /** 返回当前表格交互模式。 */
  getMode: () => DataGridMode

  /** 返回当前表格是否整体禁用。 */
  isDisabled: () => boolean

  /** 返回当前表格是否处于加载状态。 */
  isLoading: () => boolean

  /** 返回当前受控业务行。 */
  getRows: () => Row[]

  /** 返回当前全部业务列。 */
  getColumns: () => DataGridColumn<Row>[]

  /** 返回异步校验最大并发数。 */
  getValidationConcurrency: () => number

  /** 返回业务行稳定唯一标识。 */
  getRowKey: (row: Row, dataIndex: number) => DataGridRowKey

  /** 判断当前配置是否能为全部业务行提供稳定标识。 */
  hasStableRowKey: () => boolean

  /** 返回业务行在原始受控数组中的位置。 */
  findDataIndex: (row: Row) => number

  /** 判断展示坐标是否属于合并区域。 */
  isCellMerged: (displayIndex: number, field: string) => boolean

  /** 判断目标单元格是否被未完成任务阻止修改。 */
  isCellInteractionBlocked: (rowKey: DataGridRowKey, field: string) => boolean

  /** 为候选行校验启动统一的单元格 Loading 任务。 */
  startCellLoading: (rowKey: DataGridRowKey, field: string) => DataGridCellLoadingTask

  /** 根据字段变化创建尚未提交的候选业务行。 */
  createCandidateRow: (previousRow: Row, changes: DataGridPendingChange[], dataIndex: number) => Row

  /** 提交已通过校验的字段变化和追加行。 */
  commitChanges: (
    changes: DataGridPendingChange[],
    baseRows: Row[],
    appendedRowCount: number,
  ) => DataGridPasteCommitResult<Row>

  /** DataGrid 当前使用的统一校验管理器。 */
  validationManager: DataGridPasteValidationManager<Row>

  /** 立即报告粘贴前置检查或文本解析错误。 */
  reportError: (
    displayIndex: number,
    field: string,
    text: string,
    message: string,
    row?: Row,
  ) => void

  /** 报告校验或提交阶段产生的首个剪贴板错误。 */
  onClipboardError: (error: DataGridClipboardError<Row>) => void

  /** 报告未产生事务的正常粘贴结果。 */
  onPasteFeedback: (level: DataGridPasteFeedbackLevel, message: string) => void

  /** 粘贴事务成功提交后通知 DataGrid。 */
  onPaste: (payload: DataGridClipboardPastePayload<Row>) => void
}

/** 管理 DataGrid 的完整批量粘贴事务。 */
export function useDataGridPaste<Row extends DataGridRow>(options: UseDataGridPasteOptions<Row>) {
  const pasteTransactions = createDataGridPasteTransactionManager()

  function getColumn(field: string) {
    return options.getColumns().find((column) => column.field === field)
  }

  function parseClipboardValue(
    text: string,
    column: DataGridColumn<Row>,
    row: Row,
    dataIndex: number,
    displayIndex: number,
  ) {
    if (isColumnOptionsLoading(column) && text !== '') {
      throw new Error('选项数据加载中，暂时不能粘贴')
    }
    const clipboard = column.clipboard || undefined
    if (text === '' && clipboard && Object.prototype.hasOwnProperty.call(clipboard, 'emptyValue')) {
      return clipboard.emptyValue
    }
    if (clipboard?.parser) {
      return clipboard.parser(text, row)
    }
    if (column.options && text !== '' && clipboard?.matchOption !== false) {
      return matchOptionText(getColumnOptions(column), text, {
        trim: clipboard?.trim,
        ignoreCase: clipboard?.ignoreCase,
      }).value
    }
    if (
      column.editor &&
      column.editor.type === 'number' &&
      text !== '' &&
      parseDataGridNumber(text) === null
    ) {
      throw new Error(`无法转换为数字：${text}`)
    }
    return normalizeEditorValue(text, column.editor, {
      row,
      dataIndex,
      displayIndex,
      field: column.field,
      value: text,
    })
  }

  function toClipboardError(
    error: DataGridValidationError<Row>,
    text = '',
    displayIndex = error.dataIndex,
  ): DataGridClipboardError<Row> {
    return {
      displayIndex,
      field: error.field as DataGridField<Row>,
      columnTitle: error.columnTitle,
      text,
      message: error.message,
      row: error.row,
    }
  }

  function toValidationError(
    error: DataGridClipboardError<Row>,
    dataIndex: number,
  ): DataGridValidationError<Row> | undefined {
    const row = error.row
    if (!row || !error.field || dataIndex < 0) {
      return
    }
    return {
      rowKey: options.getRowKey(row, dataIndex),
      dataIndex,
      field: error.field as DataGridField<Row>,
      columnTitle: error.columnTitle ?? getColumn(error.field)?.title ?? error.field,
      value: getFieldValue(row, error.field),
      message: error.message,
      row,
      trigger: 'paste',
      source: 'column',
    }
  }

  async function pasteText(text: string) {
    const api = options.getApi()
    const bounds = options.getBounds()
    const config = options.getConfig()
    if (
      !api ||
      !bounds ||
      !config ||
      config.paste === false ||
      options.getMode() !== 'edit' ||
      options.isDisabled() ||
      options.isLoading()
    ) {
      return false
    }
    pasteTransactions.cancel()
    options.validationManager.abortAll()
    const previousValidationErrors = options.validationManager.getErrors()
    // 区域粘贴是独立事务，先取消可能仍打开的单元格编辑器，避免旧值随后覆盖批量结果。
    api.stopEditing(true)
    if (!options.hasStableRowKey()) {
      options.reportError(-1, '', text, '启用复制粘贴时必须提供稳定 rowKey')
      return false
    }
    let matrix: string[][]
    try {
      matrix =
        text === '' && config.emptyTextAction === 'clearCells' ? [['']] : parseClipboardText(text)
    } catch (error) {
      options.reportError(
        bounds.startDisplayIndex,
        bounds.columns[bounds.startColumnIndex]?.getColId() || '',
        text,
        error instanceof Error ? error.message : '剪贴板文本格式无效',
      )
      return false
    }
    if (!matrix.length) {
      options.onPasteFeedback('info', '剪贴板内容为空，未执行粘贴')
      return false
    }
    const matrixColumnCount = Math.max(...matrix.map((row) => row.length))
    const selectionRowCount = bounds.endDisplayIndex - bounds.startDisplayIndex + 1
    const selectionColumnCount = bounds.endColumnIndex - bounds.startColumnIndex + 1
    const repeat =
      config.repeatToSelection !== false &&
      selectionRowCount >= matrix.length &&
      selectionColumnCount >= matrixColumnCount &&
      selectionRowCount % matrix.length === 0 &&
      selectionColumnCount % matrixColumnCount === 0
    let targetRowCount = repeat ? selectionRowCount : matrix.length
    let targetColumnCount = repeat ? selectionColumnCount : matrixColumnCount
    const displayedColumns = bounds.columns
    const displayedRowCount = api.getDisplayedRowCount()
    const availableColumnCount = Math.max(0, displayedColumns.length - bounds.startColumnIndex)
    const overflowColumnCount = Math.max(0, targetColumnCount - availableColumnCount)
    targetColumnCount = Math.min(targetColumnCount, availableColumnCount)

    const availableRowCount = Math.max(0, displayedRowCount - bounds.startDisplayIndex)
    const overflowRowCount = Math.max(0, targetRowCount - availableRowCount)
    const overflow = config.overflow ?? 'append'
    const canAppend = overflow === 'append' || overflow === 'auto'
    if (overflowRowCount && overflow === 'truncate') {
      targetRowCount = availableRowCount
    }
    if (overflowRowCount && !canAppend && overflow !== 'truncate') {
      options.reportError(
        bounds.startDisplayIndex,
        displayedColumns[bounds.startColumnIndex]?.getColId() || '',
        text,
        '粘贴行数超出表格范围',
      )
      return false
    }
    if (!targetRowCount) {
      return false
    }

    const currentRows = options.getRows()
    const appendedRows: Row[] = []
    if (overflowRowCount && canAppend) {
      const existingKeyTokens = new Set(
        currentRows.map((row, index) => encodeDataGridRowKey(options.getRowKey(row, index))),
      )
      try {
        for (let appendIndex = 0; appendIndex < overflowRowCount; appendIndex += 1) {
          const dataIndex = currentRows.length + appendIndex
          const context = {
            dataIndex,
            appendIndex,
            sourceRow: api.getDisplayedRowAtIndex(displayedRowCount - 1)?.data,
          }
          const row = (config.createRow?.(context) ?? {}) as Row
          const key = options.getRowKey(row, dataIndex)
          const keyToken = encodeDataGridRowKey(key)
          if (existingKeyTokens.has(keyToken)) {
            throw new Error(`新增行 rowKey 无效或重复：${String(key)}`)
          }
          existingKeyTokens.add(keyToken)
          appendedRows.push(row)
        }
      } catch (error) {
        options.reportError(
          bounds.startDisplayIndex + availableRowCount,
          displayedColumns[bounds.startColumnIndex]?.getColId() || '',
          text,
          error instanceof Error ? error.message : '创建新增行失败',
        )
        return false
      }
    }
    const baseRows = [...currentRows, ...appendedRows]
    const pendingChanges: DataGridPendingChange[] = []
    const errors: DataGridClipboardError<Row>[] = []
    const validationErrors: DataGridValidationError<Row>[] = []
    const cellErrorMode = config.errorHandling?.cellErrorMode ?? 'abort'
    const rowErrorMode = config.errorHandling?.rowErrorMode ?? 'abort'
    const rejectedDataIndexes = new Set<number>()
    const affectedRowKeys = new Set<DataGridRowKey>()
    let skippedCellCount = overflowColumnCount * targetRowCount
    let skippedRowCount = 0
    let pasteableCellCount = 0
    let aborted = false
    const pasteTransaction = pasteTransactions.begin()
    const pasteController = pasteTransaction.controller
    const appendError = (error: DataGridClipboardError<Row>, dataIndex: number) => {
      errors.push(error)
      const validationError = toValidationError(error, dataIndex)
      if (validationError) {
        validationErrors.push(validationError)
      }
    }
    const applyPasteValidationErrors = (nextErrors: DataGridValidationError<Row>[]) => {
      options.validationManager.setErrors([
        ...previousValidationErrors.filter((error) => !affectedRowKeys.has(error.rowKey)),
        ...nextErrors,
      ])
    }
    for (let rowOffset = 0; rowOffset < targetRowCount; rowOffset += 1) {
      const displayIndex = bounds.startDisplayIndex + rowOffset
      const appendIndex = rowOffset - availableRowCount
      const row =
        rowOffset < availableRowCount
          ? api.getDisplayedRowAtIndex(displayIndex)?.data
          : appendedRows[appendIndex]
      if (!row) {
        continue
      }
      const dataIndex =
        rowOffset < availableRowCount
          ? options.findDataIndex(row)
          : currentRows.length + appendIndex
      const rowKey = options.getRowKey(row, dataIndex)
      affectedRowKeys.add(rowKey)
      for (let columnOffset = 0; columnOffset < targetColumnCount; columnOffset += 1) {
        const agColumn = displayedColumns[bounds.startColumnIndex + columnOffset]
        const column = agColumn ? getColumn(agColumn.getColId()) : undefined
        const sourceText =
          matrix[rowOffset % matrix.length]?.[columnOffset % matrixColumnCount] ?? ''
        if (!column) {
          continue
        }
        if (column.clipboard === false || column.clipboard?.paste === false) {
          skippedCellCount += 1
          continue
        }
        if (options.isCellInteractionBlocked(rowKey, column.field)) {
          appendError(
            {
              displayIndex,
              field: column.field,
              columnTitle: column.title,
              text: sourceText,
              message: '目标单元格正在处理中，不能粘贴',
              row,
            },
            dataIndex,
          )
          if (cellErrorMode === 'abort') {
            aborted = true
            break
          }
          if (cellErrorMode === 'skipRow') {
            rejectedDataIndexes.add(dataIndex)
            break
          }
          skippedCellCount += 1
          continue
        }
        if (options.isCellMerged(displayIndex, column.field)) {
          skippedCellCount += 1
          continue
        }
        if (isColumnOptionsLoading(column) && sourceText !== '') {
          appendError(
            {
              displayIndex,
              field: column.field,
              columnTitle: column.title,
              text: sourceText,
              message: '选项数据加载中，暂时不能粘贴',
              row,
            },
            dataIndex,
          )
          if (cellErrorMode === 'abort') {
            aborted = true
            break
          }
          if (cellErrorMode === 'skipRow') {
            rejectedDataIndexes.add(dataIndex)
            break
          }
          skippedCellCount += 1
          continue
        }
        pasteableCellCount += 1
        try {
          pendingChanges.push({
            dataIndex,
            field: column.field,
            newValue: parseClipboardValue(sourceText, column, row, dataIndex, displayIndex),
            text: sourceText,
            displayIndex,
          })
        } catch (error) {
          appendError(
            {
              displayIndex,
              field: column.field,
              columnTitle: column.title,
              text: sourceText,
              message: error instanceof Error ? error.message : '粘贴内容无效',
              row,
            },
            dataIndex,
          )
          if (cellErrorMode === 'abort') {
            aborted = true
            break
          }
          if (cellErrorMode === 'skipRow') {
            rejectedDataIndexes.add(dataIndex)
            break
          }
          skippedCellCount += 1
        }
      }
      if (aborted) {
        break
      }
    }

    if (aborted) {
      applyPasteValidationErrors(validationErrors)
      options.onClipboardError(errors[0])
      pasteTransactions.finish(pasteTransaction)
      return false
    }

    if (!pasteableCellCount) {
      options.onPasteFeedback('warning', '选区内没有可粘贴的单元格')
      pasteTransactions.finish(pasteTransaction)
      return false
    }

    const changesByRow = new Map<number, DataGridPendingChange[]>()
    pendingChanges.forEach((change) => {
      const rowChanges = changesByRow.get(change.dataIndex) ?? []
      rowChanges.push(change)
      changesByRow.set(change.dataIndex, rowChanges)
    })
    const acceptedChangesByRow = new Map<number, DataGridPendingChange[]>()
    const rowTasks = [...changesByRow.entries()].filter(
      ([dataIndex]) => !rejectedDataIndexes.has(dataIndex),
    )
    let nextTaskIndex = 0
    const workerCount = Math.min(
      Math.max(1, options.getValidationConcurrency()),
      Math.max(1, rowTasks.length),
    )

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextTaskIndex < rowTasks.length && !pasteController.signal.aborted) {
          const task = rowTasks[nextTaskIndex]
          nextTaskIndex += 1
          const [dataIndex, originalChanges] = task
          const previousRow = baseRows[dataIndex]
          if (!previousRow) {
            continue
          }
          let currentChanges = originalChanges.slice()
          let accepted = false
          for (
            let attempt = 0;
            attempt <= originalChanges.length && currentChanges.length;
            attempt += 1
          ) {
            let candidateRow: Row
            try {
              candidateRow = options.createCandidateRow(previousRow, currentChanges, dataIndex)
            } catch (error) {
              const change = currentChanges[0]
              const processError: DataGridClipboardError<Row> = {
                displayIndex: change.displayIndex ?? dataIndex,
                field: change.field as DataGridField<Row>,
                columnTitle: getColumn(change.field)?.title ?? change.field,
                text: change.text ?? '',
                message: error instanceof Error ? error.message : '行业务处理失败',
                row: previousRow,
              }
              appendError(processError, dataIndex)
              if (rowErrorMode === 'abort') {
                aborted = true
                pasteController.abort()
              } else {
                rejectedDataIndexes.add(dataIndex)
              }
              break
            }
            const rowKey = options.getRowKey(previousRow, dataIndex)
            const changedFields = [
              ...new Set(currentChanges.map((change) => change.field)),
            ] as DataGridField<Row>[]
            const loadingTasks = changedFields.map((field) =>
              options.startCellLoading(rowKey, field),
            )
            let rowValidationErrors: DataGridValidationError<Row>[]
            try {
              rowValidationErrors = await options.validationManager.validateCandidate({
                row: candidateRow,
                previousRow,
                dataIndex,
                rowKey,
                changedFields,
                fields: changedFields,
                trigger: 'paste',
                signal: pasteController.signal,
              })
            } finally {
              loadingTasks.forEach((task) => task.finish())
            }
            if (pasteController.signal.aborted) {
              break
            }
            if (!rowValidationErrors.length) {
              acceptedChangesByRow.set(dataIndex, currentChanges)
              accepted = true
              break
            }
            rowValidationErrors.forEach((error) => {
              if (
                !validationErrors.some(
                  (item) =>
                    item.rowKey === error.rowKey &&
                    item.field === error.field &&
                    item.message === error.message,
                )
              ) {
                validationErrors.push(error)
                const change = currentChanges.find((item) => item.field === error.field)
                errors.push(toClipboardError(error, change?.text, change?.displayIndex))
              }
            })
            const rowRuleFailed = rowValidationErrors.some((error) => error.source === 'row')
            if (rowRuleFailed) {
              if (rowErrorMode === 'abort') {
                aborted = true
                pasteController.abort()
              } else {
                rejectedDataIndexes.add(dataIndex)
              }
              break
            }
            if (cellErrorMode === 'abort') {
              aborted = true
              pasteController.abort()
              break
            }
            if (cellErrorMode === 'skipRow') {
              rejectedDataIndexes.add(dataIndex)
              break
            }
            const failedFields = new Set<string>(
              rowValidationErrors.map((error) => String(error.field)),
            )
            const nextChanges = currentChanges.filter((change) => !failedFields.has(change.field))
            const removedCount = currentChanges.length - nextChanges.length
            if (!removedCount) {
              if (rowErrorMode === 'abort') {
                aborted = true
                pasteController.abort()
              } else {
                rejectedDataIndexes.add(dataIndex)
              }
              break
            }
            skippedCellCount += removedCount
            if (!nextChanges.length) {
              if (dataIndex < currentRows.length) {
                accepted = true
              } else {
                rejectedDataIndexes.add(dataIndex)
              }
              break
            }
            currentChanges = nextChanges
          }
          if (!accepted && !aborted && !rejectedDataIndexes.has(dataIndex)) {
            rejectedDataIndexes.add(dataIndex)
          }
        }
      }),
    )

    if (!pasteTransactions.isCurrent(pasteTransaction)) {
      return false
    }
    if (aborted) {
      applyPasteValidationErrors(validationErrors)
      if (errors.length) {
        options.onClipboardError(errors[0])
      }
      pasteTransactions.finish(pasteTransaction)
      return false
    }

    skippedRowCount = rejectedDataIndexes.size
    const acceptedAppendedRows: Row[] = []
    const appendedIndexMap = new Map<number, number>()
    appendedRows.forEach((row, appendIndex) => {
      const originalDataIndex = currentRows.length + appendIndex
      if (!acceptedChangesByRow.has(originalDataIndex)) {
        return
      }
      const nextDataIndex = currentRows.length + acceptedAppendedRows.length
      appendedIndexMap.set(originalDataIndex, nextDataIndex)
      acceptedAppendedRows.push(row)
    })
    const acceptedChanges = [...acceptedChangesByRow.entries()].flatMap(([dataIndex, rowChanges]) =>
      rowChanges.map((change) => ({
        ...change,
        dataIndex: appendedIndexMap.get(dataIndex) ?? dataIndex,
      })),
    )
    const finalBaseRows = [...currentRows, ...acceptedAppendedRows]
    const result = options.commitChanges(
      acceptedChanges,
      finalBaseRows,
      acceptedAppendedRows.length,
    )
    if (result.errors.length) {
      const firstError = result.errors[0]
      appendError(
        firstError,
        firstError.row ? options.findDataIndex(firstError.row) : firstError.displayIndex,
      )
      applyPasteValidationErrors(validationErrors)
      options.onClipboardError(firstError)
      pasteTransactions.finish(pasteTransaction)
      return false
    }
    const acceptedAppendedRowKeys = new Set(
      acceptedAppendedRows.map((row, index) => options.getRowKey(row, currentRows.length + index)),
    )
    applyPasteValidationErrors(
      validationErrors.filter(
        (error) =>
          error.dataIndex < currentRows.length || acceptedAppendedRowKeys.has(error.rowKey),
      ),
    )
    if (errors.length) {
      options.onClipboardError(errors[0])
    }
    if (!result.changes.length && !result.appendedRows.length) {
      options.onPasteFeedback('info', '粘贴内容与当前数据相同，未产生修改')
      pasteTransactions.finish(pasteTransaction)
      return false
    }
    const committedTargetRowCount =
      Math.min(targetRowCount, availableRowCount) + result.appendedRows.length
    const endDisplayIndex = bounds.startDisplayIndex + committedTargetRowCount - 1
    const endColumn = displayedColumns[bounds.startColumnIndex + targetColumnCount - 1]
    options.selectRange(
      {
        displayIndex: bounds.startDisplayIndex,
        columnId: displayedColumns[bounds.startColumnIndex].getColId(),
      },
      {
        displayIndex: endDisplayIndex,
        columnId: endColumn.getColId(),
      },
    )
    options.onPaste({
      text,
      range: options.getSelectionRange(),
      changedCount: result.changes.length,
      skippedCount: skippedCellCount + skippedRowCount,
      skippedCellCount,
      skippedRowCount,
      changes: result.changes,
      errors,
      appendedCount: result.appendedRows.length,
      appendedRows: result.appendedRows,
    })
    pasteTransactions.finish(pasteTransaction)
    return true
  }

  onBeforeUnmount(pasteTransactions.cancel)

  return {
    /** 取消当前仍在执行的粘贴事务。 */
    cancel: pasteTransactions.cancel,

    /** 将剪贴板纯文本按当前选区和配置提交。 */
    pasteText,
  }
}
