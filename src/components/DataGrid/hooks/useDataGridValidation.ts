/**
 * 组合函数名称：DataGrid 统一校验
 * 使用场景：集中执行 DataGrid 列规则、行规则、异步取消、并发控制和错误状态管理。
 */

import { ref, type Ref } from 'vue'
import { getFieldValue } from '../utils'
import type {
  DataGridColumn,
  DataGridCellLoadingTask,
  DataGridField,
  DataGridRow,
  DataGridRowRule,
  DataGridValidateTrigger,
  DataGridValidationError,
  DataGridValidationResult,
  DataGridValidationState,
} from '../types'

/** DataGrid 单行校验请求。 */
export interface DataGridValidateRowRequest<Row extends DataGridRow> {
  /** 当前候选行。 */
  row: Row

  /** 修改前的行数据。 */
  previousRow?: Row

  /** 当前行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前行稳定标识。 */
  rowKey: string | number

  /** 本次事务修改的字段。 */
  changedFields: DataGridField<Row>[]

  /** 本次校验的触发场景。 */
  trigger: DataGridValidateTrigger

  /** 仅执行指定字段的列规则。 */
  fields?: DataGridField<Row>[]

  /** 是否执行行级规则。 */
  includeRowRules?: boolean

  /** 外部事务用于取消本次校验的信号。 */
  signal?: AbortSignal
}

/** DataGrid 统一校验组合函数参数。 */
interface UseDataGridValidationOptions<Row extends DataGridRow> {
  /** 返回当前列配置。 */
  getColumns: () => DataGridColumn<Row>[]

  /** 返回当前行级规则。 */
  getRowRules: () => DataGridRowRule<Row>[]

  /** 返回当前是否启用业务校验。 */
  isEnabled: () => boolean

  /** 返回异步校验最大并发数。 */
  getConcurrency: () => number

  /** 判断指定行当前是否仍存在。 */
  isRowActive: (rowKey: string | number) => boolean

  /** 校验状态变化时通知 DataGrid。 */
  onChange: (state: DataGridValidationState<Row>) => void

  /** 错误或校验中状态变化后刷新表格单元格。 */
  onRefresh: () => void

  /** 为异步校验涉及的单元格启动统一 Loading 任务。 */
  startCellLoading: (rowKey: string | number, field: DataGridField<Row>) => DataGridCellLoadingTask
}

/** DataGrid 单次候选行校验的内部生命周期回调。 */
interface DataGridValidationLifecycle<Row extends DataGridRow> {
  /** 某条规则实际返回 Promise 时通知管理器展示对应字段的异步校验状态。 */
  onAsyncStart?: (fields: DataGridField<Row>[]) => void
}

/** DataGrid 内部受控的单行异步校验任务。 */
interface DataGridActiveValidation {
  /** 当前任务版本。 */
  version: number

  /** 当前任务取消控制器。 */
  controller: AbortController

  /** 当前校验占用的全部单元格 Loading 任务。 */
  loadingTasks: DataGridCellLoadingTask[]
}

/** 判断 DataGrid 必填规则使用的空值。 */
function isEmptyValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** 判断规则是否需要在当前业务场景执行。 */
function matchesTrigger(
  triggers: DataGridValidateTrigger[] | undefined,
  trigger: DataGridValidateTrigger,
) {
  return !triggers?.length || triggers.includes(trigger)
}

/** 将任意校验异常转换成稳定错误消息。 */
function getValidationExceptionMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '校验执行失败'
}

/** 判断校验器返回值是否为可等待的异步结果。 */
function isPromiseLike<Value>(value: Value | PromiseLike<Value>): value is PromiseLike<Value> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

/**
 * 按固定并发数执行任务。
 * 校验行数较多时避免同步发起全部异步请求，防止浏览器和接口瞬时过载。
 */
async function runWithConcurrency<Item>(
  items: Item[],
  concurrency: number,
  worker: (item: Item) => Promise<void>,
) {
  let nextIndex = 0
  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length))
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex]
        nextIndex += 1
        await worker(item)
      }
    }),
  )
}

/** 管理 DataGrid 的统一业务校验。 */
export function useDataGridValidation<Row extends DataGridRow>(
  options: UseDataGridValidationOptions<Row>,
) {
  const errorMap = ref(
    new Map<string | number, Map<string, DataGridValidationError<Row>>>(),
  ) as Ref<Map<string | number, Map<string, DataGridValidationError<Row>>>>
  const validatingFieldMap = ref(new Map<string | number, Set<string>>()) as Ref<
    Map<string | number, Set<string>>
  >
  const activeValidationMap = new Map<string | number, DataGridActiveValidation>()
  const rowVersions = new Map<string | number, number>()

  function getErrors() {
    return [...errorMap.value.values()].flatMap((fieldErrors) => [...fieldErrors.values()])
  }

  function isValidating() {
    return validatingFieldMap.value.size > 0
  }

  function notifyChange() {
    const errors = getErrors()
    options.onChange({
      validating: isValidating(),
      valid: errors.length === 0,
      errors,
    })
    options.onRefresh()
  }

  function getFieldError(rowKey: string | number, field: string) {
    return errorMap.value.get(rowKey)?.get(field)
  }

  function isCellError(rowKey: string | number, field: string) {
    return Boolean(getFieldError(rowKey, field))
  }

  function isCellValidating(rowKey: string | number, field: string) {
    return Boolean(validatingFieldMap.value.get(rowKey)?.has(field))
  }

  function getCellErrorMessage(rowKey: string | number, field: string) {
    return getFieldError(rowKey, field)?.message
  }

  function createError(
    request: DataGridValidateRowRequest<Row>,
    field: DataGridField<Row>,
    message: string,
    source: 'column' | 'row',
  ): DataGridValidationError<Row> {
    const column = options.getColumns().find((item) => item.field === field)
    return {
      rowKey: request.rowKey,
      dataIndex: request.dataIndex,
      field,
      columnTitle: column?.title ?? String(field),
      value: getFieldValue(request.row, field),
      message,
      row: request.row,
      trigger: request.trigger,
      source,
    }
  }

  async function validateCandidate(
    request: DataGridValidateRowRequest<Row>,
    lifecycle: DataGridValidationLifecycle<Row> = {},
  ): Promise<DataGridValidationError<Row>[]> {
    if (!options.isEnabled()) {
      return []
    }
    const controller = request.signal ? undefined : new AbortController()
    const signal = request.signal ?? controller!.signal
    const errors = new Map<string, DataGridValidationError<Row>>()
    const fields = request.fields ? new Set<string>(request.fields) : undefined
    const columns = options.getColumns()

    for (const column of columns) {
      if (signal.aborted || (fields && !fields.has(column.field))) {
        continue
      }
      const rules = column.rules ?? []
      const value = getFieldValue(request.row, column.field)
      for (const rule of rules) {
        if (signal.aborted || !matchesTrigger(rule.triggers, request.trigger)) {
          continue
        }
        if (rule.required && isEmptyValue(value)) {
          errors.set(
            column.field,
            createError(request, column.field, rule.message || `${column.title}必填`, 'column'),
          )
          break
        }
        if (!rule.validator) {
          continue
        }
        try {
          const validationResult = rule.validator(value, request.row, {
            trigger: request.trigger,
            row: request.row,
            previousRow: request.previousRow,
            field: column.field,
            dataIndex: request.dataIndex,
            rowKey: request.rowKey,
            changedFields: request.changedFields,
            signal,
          })
          if (isPromiseLike(validationResult)) {
            lifecycle.onAsyncStart?.([column.field])
          }
          const result = isPromiseLike(validationResult) ? await validationResult : validationResult
          if (typeof result === 'string') {
            errors.set(column.field, createError(request, column.field, result, 'column'))
            break
          }
        } catch (error) {
          if (!signal.aborted) {
            errors.set(
              column.field,
              createError(request, column.field, getValidationExceptionMessage(error), 'column'),
            )
          }
          break
        }
      }
    }

    if (request.includeRowRules !== false && !signal.aborted) {
      for (const rule of options.getRowRules()) {
        if (signal.aborted || !matchesTrigger(rule.triggers, request.trigger)) {
          continue
        }
        try {
          const validationResult = rule.validator(request.row, {
            trigger: request.trigger,
            row: request.row,
            previousRow: request.previousRow,
            dataIndex: request.dataIndex,
            rowKey: request.rowKey,
            changedFields: request.changedFields,
            signal,
          })
          if (isPromiseLike(validationResult)) {
            const fields = request.changedFields.length
              ? request.changedFields
              : (request.fields ?? [])
            lifecycle.onAsyncStart?.(fields)
          }
          const result = isPromiseLike(validationResult) ? await validationResult : validationResult
          const issues = result === true ? [] : Array.isArray(result) ? result : [result]
          issues.forEach((issue) => {
            if (!errors.has(issue.field)) {
              errors.set(issue.field, createError(request, issue.field, issue.message, 'row'))
            }
          })
        } catch (error) {
          if (!signal.aborted) {
            const field = request.changedFields[0] ?? options.getColumns()[0]?.field
            if (field && !errors.has(field)) {
              errors.set(
                field,
                createError(request, field, getValidationExceptionMessage(error), 'row'),
              )
            }
          }
        }
      }
    }

    return signal.aborted ? [] : [...errors.values()]
  }

  function setValidatingFields(rowKey: string | number, fields: DataGridField<Row>[]) {
    const nextMap = new Map(validatingFieldMap.value)
    if (fields.length) {
      nextMap.set(rowKey, new Set(fields))
    } else {
      nextMap.delete(rowKey)
    }
    validatingFieldMap.value = nextMap
  }

  function replaceRowErrors(
    rowKey: string | number,
    errors: DataGridValidationError<Row>[],
    fields?: DataGridField<Row>[],
  ) {
    const nextMap = new Map(errorMap.value)
    const currentFields = new Map(nextMap.get(rowKey) ?? [])
    if (fields) {
      fields.forEach((field) => currentFields.delete(field))
    } else {
      currentFields.clear()
    }
    errors.forEach((error) => currentFields.set(error.field, error))
    if (currentFields.size) {
      nextMap.set(rowKey, currentFields)
    } else {
      nextMap.delete(rowKey)
    }
    errorMap.value = nextMap
  }

  function abortRow(rowKey: string | number) {
    const active = activeValidationMap.get(rowKey)
    active?.controller.abort()
    active?.loadingTasks.forEach((task) => task.finish())
    activeValidationMap.delete(rowKey)
    setValidatingFields(rowKey, [])
  }

  function abortAll() {
    activeValidationMap.forEach((active) => {
      active.controller.abort()
      active.loadingTasks.forEach((task) => task.finish())
    })
    activeValidationMap.clear()
    validatingFieldMap.value = new Map()
    notifyChange()
  }

  async function validateManagedRow(request: DataGridValidateRowRequest<Row>) {
    if (!options.isEnabled()) {
      abortRow(request.rowKey)
      replaceRowErrors(request.rowKey, [], request.fields)
      notifyChange()
      return { valid: true, errors: [] } satisfies DataGridValidationResult<Row>
    }
    abortRow(request.rowKey)
    const version = (rowVersions.get(request.rowKey) ?? 0) + 1
    const controller = new AbortController()
    rowVersions.set(request.rowKey, version)
    const loadingTasks: DataGridCellLoadingTask[] = []
    const asyncFields = new Set<DataGridField<Row>>()
    activeValidationMap.set(request.rowKey, { version, controller, loadingTasks })
    // 新一轮校验开始即移除对应旧错误，避免异步结果返回前继续展示过期消息。
    replaceRowErrors(request.rowKey, [], request.fields)
    notifyChange()

    const errors = await validateCandidate(
      {
        ...request,
        signal: controller.signal,
      },
      {
        onAsyncStart(fields) {
          const active = activeValidationMap.get(request.rowKey)
          if (!active || active.version !== version || controller.signal.aborted) {
            return
          }
          fields.forEach((field) => {
            if (asyncFields.has(field)) {
              return
            }
            asyncFields.add(field)
            loadingTasks.push(options.startCellLoading(request.rowKey, field))
          })
          setValidatingFields(request.rowKey, [...asyncFields])
          notifyChange()
        },
      },
    )
    const active = activeValidationMap.get(request.rowKey)
    if (
      controller.signal.aborted ||
      !active ||
      active.version !== version ||
      !options.isRowActive(request.rowKey)
    ) {
      if (active?.version === version) {
        active.loadingTasks.forEach((task) => task.finish())
        activeValidationMap.delete(request.rowKey)
        setValidatingFields(request.rowKey, [])
        notifyChange()
      }
      return { valid: true, errors: [] } satisfies DataGridValidationResult<Row>
    }
    active.loadingTasks.forEach((task) => task.finish())
    activeValidationMap.delete(request.rowKey)
    setValidatingFields(request.rowKey, [])
    replaceRowErrors(request.rowKey, errors, request.fields)
    notifyChange()
    return { valid: errors.length === 0, errors } satisfies DataGridValidationResult<Row>
  }

  async function validateRows(requests: DataGridValidateRowRequest<Row>[]) {
    abortAll()
    errorMap.value = new Map()
    notifyChange()
    if (!options.isEnabled()) {
      return { valid: true, errors: [] } satisfies DataGridValidationResult<Row>
    }
    await runWithConcurrency(requests, options.getConcurrency(), async (request) => {
      await validateManagedRow(request)
    })
    const errors = getErrors()
    return { valid: errors.length === 0, errors } satisfies DataGridValidationResult<Row>
  }

  function clearErrors(rowKey?: string | number, field?: string) {
    if (rowKey === undefined) {
      if (!field) {
        errorMap.value = new Map()
      } else {
        const nextMap = new Map(errorMap.value)
        nextMap.forEach((fieldErrors, currentRowKey) => {
          const nextFieldErrors = new Map(fieldErrors)
          nextFieldErrors.delete(field)
          if (nextFieldErrors.size) {
            nextMap.set(currentRowKey, nextFieldErrors)
          } else {
            nextMap.delete(currentRowKey)
          }
        })
        errorMap.value = nextMap
      }
      notifyChange()
      return
    }
    const nextMap = new Map(errorMap.value)
    if (!field) {
      nextMap.delete(rowKey)
    } else {
      const fieldErrors = new Map(nextMap.get(rowKey) ?? [])
      fieldErrors.delete(field)
      if (fieldErrors.size) {
        nextMap.set(rowKey, fieldErrors)
      } else {
        nextMap.delete(rowKey)
      }
    }
    errorMap.value = nextMap
    notifyChange()
  }

  function setErrors(errors: DataGridValidationError<Row>[]) {
    if (!options.isEnabled()) {
      if (errorMap.value.size) {
        errorMap.value = new Map()
        notifyChange()
      }
      return
    }
    const nextMap = new Map<string | number, Map<string, DataGridValidationError<Row>>>()
    errors.forEach((error) => {
      const fieldErrors =
        nextMap.get(error.rowKey) ?? new Map<string, DataGridValidationError<Row>>()
      if (!fieldErrors.has(error.field)) {
        fieldErrors.set(error.field, error)
      }
      nextMap.set(error.rowKey, fieldErrors)
    })
    errorMap.value = nextMap
    notifyChange()
  }

  return {
    abortAll,
    abortRow,
    clearErrors,
    getCellErrorMessage,
    getErrors,
    isCellError,
    isCellValidating,
    isValidating,
    setErrors,
    validateCandidate,
    validateManagedRow,
    validateRows,
  }
}
