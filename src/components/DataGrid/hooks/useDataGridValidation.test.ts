import { describe, expect, it } from 'vitest'
import { useDataGridValidation } from './useDataGridValidation'
import type {
  DataGridCellLoadingTask,
  DataGridColumn,
  DataGridField,
  DataGridRowRule,
} from '../types'

/** 校验测试使用的业务行。 */
interface ValidationRow extends Record<string, unknown> {
  /** 当前业务行唯一标识。 */
  id: number

  /** 当前业务名称。 */
  name: string

  /** 当前业务数量。 */
  quantity: number

  /** 当前业务上限。 */
  limit: number
}

/** 测试中手动控制完成时机的异步结果。 */
interface Deferred<Value> {
  /** 当前异步结果。 */
  promise: Promise<Value>

  /** 完成当前异步结果。 */
  resolve: (value: Value) => void
}

function createDeferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function createValidationManager(
  columns: DataGridColumn<ValidationRow>[],
  rowRules: DataGridRowRule<ValidationRow>[] = [],
  startCellLoading: (
    rowKey: string | number,
    field: DataGridField<ValidationRow>,
  ) => DataGridCellLoadingTask = () => ({
    finish: () => undefined,
  }),
) {
  return useDataGridValidation<ValidationRow>({
    getColumns: () => columns,
    getRowRules: () => rowRules,
    isEnabled: () => true,
    getConcurrency: () => 2,
    isRowActive: () => true,
    onChange: () => undefined,
    onRefresh: () => undefined,
    startCellLoading,
  })
}

describe('DataGrid validation transactions', () => {
  it('collects field and cross-field errors in one candidate validation', async () => {
    const manager = createValidationManager(
      [
        { field: 'name', title: '名称', rules: [{ required: true, message: '名称不能为空' }] },
        { field: 'quantity', title: '数量' },
        { field: 'limit', title: '上限' },
      ],
      [
        {
          validator: (row) =>
            row.quantity <= row.limit
              ? true
              : {
                  field: 'quantity',
                  message: '数量不能超过上限',
                },
        },
      ],
    )
    const row: ValidationRow = { id: 1, name: '', quantity: 5, limit: 3 }
    const errors = await manager.validateCandidate({
      row,
      dataIndex: 0,
      rowKey: row.id,
      changedFields: ['name', 'quantity'],
      trigger: 'submit',
    })

    expect(errors.map((error) => [error.field, error.message, error.source])).toEqual([
      ['name', '名称不能为空', 'column'],
      ['quantity', '数量不能超过上限', 'row'],
    ])
  })

  it('ignores an older async result after a newer row validation starts', async () => {
    const first = createDeferred<true | string>()
    const second = createDeferred<true | string>()
    let callCount = 0
    const manager = createValidationManager([
      {
        field: 'name',
        title: '名称',
        rules: [
          {
            validator: () => {
              callCount += 1
              return callCount === 1 ? first.promise : second.promise
            },
          },
        ],
      },
    ])
    const row: ValidationRow = { id: 1, name: '新名称', quantity: 1, limit: 3 }
    const request = {
      row,
      dataIndex: 0,
      rowKey: row.id,
      changedFields: ['name'] as Array<keyof ValidationRow & string>,
      trigger: 'edit' as const,
    }
    const older = manager.validateManagedRow(request)
    const newer = manager.validateManagedRow(request)

    first.resolve('旧请求错误')
    second.resolve(true)

    await expect(older).resolves.toEqual({ valid: true, errors: [] })
    await expect(newer).resolves.toEqual({ valid: true, errors: [] })
    expect(manager.getErrors()).toEqual([])
  })

  it('does not enter the loading state for synchronous validators', async () => {
    const loadingFields: string[] = []
    const manager = createValidationManager(
      [
        {
          field: 'quantity',
          title: '数量',
          rules: [{ validator: (value) => (Number(value) > 0 ? true : '数量必须大于 0') }],
        },
      ],
      [],
      (_rowKey, field) => {
        loadingFields.push(field)
        return { finish: () => undefined }
      },
    )
    const row: ValidationRow = { id: 1, name: '物料', quantity: 0, limit: 3 }

    const result = await manager.validateManagedRow({
      row,
      dataIndex: 0,
      rowKey: row.id,
      changedFields: ['quantity'],
      trigger: 'edit',
    })

    expect(result.valid).toBe(false)
    expect(loadingFields).toEqual([])
    expect(manager.isValidating()).toBe(false)
  })

  it('starts and finishes loading only when a validator returns a Promise', async () => {
    const deferred = createDeferred<true | string>()
    const loadingFields: string[] = []
    let finishCount = 0
    const manager = createValidationManager(
      [
        {
          field: 'name',
          title: '名称',
          rules: [{ validator: () => deferred.promise }],
        },
      ],
      [],
      (_rowKey, field) => {
        loadingFields.push(field)
        return {
          finish() {
            finishCount += 1
          },
        }
      },
    )
    const row: ValidationRow = { id: 1, name: '新名称', quantity: 1, limit: 3 }
    const validation = manager.validateManagedRow({
      row,
      dataIndex: 0,
      rowKey: row.id,
      changedFields: ['name'],
      trigger: 'edit',
    })

    expect(loadingFields).toEqual(['name'])
    expect(manager.isValidating()).toBe(true)
    deferred.resolve(true)
    await validation

    expect(finishCount).toBe(1)
    expect(manager.isValidating()).toBe(false)
  })
})
