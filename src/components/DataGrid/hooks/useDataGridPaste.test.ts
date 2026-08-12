// @vitest-environment jsdom

import type { GridApi } from 'ag-grid-community'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { resolveDataGridRowKey } from '../rowKey'
import type { DataGridPendingChange } from '../transaction'
import type {
  DataGridClipboardPastePayload,
  DataGridColumn,
  DataGridRow,
  DataGridValueChange,
} from '../types'
import type { DataGridSelectionBounds } from './useDataGridSelection'
import { useDataGridPaste } from './useDataGridPaste'

/** 在粘贴组合函数测试中模拟 DataGrid 的不可变行事务。 */
function commitPendingChanges(
  pendingChanges: DataGridPendingChange[],
  baseRows: DataGridRow[],
  appendedRowCount = 0,
) {
  const rows = baseRows.slice()
  const changes = pendingChanges.map<DataGridValueChange<DataGridRow>>((change) => {
    const previousRow = rows[change.dataIndex]
    const row = {
      ...previousRow,
      [change.field]: change.newValue,
    }
    rows[change.dataIndex] = row
    return {
      rowKey: resolveDataGridRowKey(row),
      dataIndex: change.dataIndex,
      field: change.field,
      oldValue: previousRow?.[change.field],
      newValue: change.newValue,
      row,
    }
  })
  return {
    changes,
    appendedRows: appendedRowCount ? rows.slice(-appendedRowCount) : [],
    errors: [],
  }
}

describe('useDataGridPaste', () => {
  it('appends an internally identified empty row when createRow is omitted', async () => {
    const columns = [
      {
        field: 'sequence',
        title: '序号',
      },
      {
        field: 'name',
        title: '名称',
        editor: { type: 'text' as const },
      },
    ]
    const agColumns = columns.map((column) => ({
      getColId: () => column.field,
    }))
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 0,
      endColumnIndex: 1,
      columns: agColumns,
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => 0,
      getDisplayedRowAtIndex: () => undefined,
    } as unknown as GridApi<DataGridRow>
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    const commitChanges = vi.fn(commitPendingChanges)
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange: vi.fn(),
            getConfig: () => ({}),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => [],
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (row) => resolveDataGridRowKey(row),
            hasStableRowKey: () => true,
            findDataIndex: () => -1,
            isCellMerged: () => false,
            isCellInteractionBlocked: () => false,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow, changes) => ({
              ...previousRow,
              ...Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
            }),
            commitChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError: vi.fn(),
            onClipboardError: vi.fn(),
            onPasteFeedback: vi.fn(),
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('1\t新物料')).resolves.toBe(true)
    expect(commitChanges).toHaveBeenCalledWith(expect.any(Array), [expect.objectContaining({})], 1)
    const appendedRow = onPaste.mock.calls[0][0].appendedRows[0]
    expect(appendedRow.sequence).toBe('1')
    expect(appendedRow.name).toBe('新物料')
    expect(onPaste.mock.calls[0][0].skippedCellCount).toBe(0)
    expect(resolveDataGridRowKey(appendedRow)).toEqual(expect.any(String))

    wrapper.unmount()
  })

  it('limits the pasted selection to rows that remain after a planned appended row is skipped', async () => {
    const row = { id: 1, name: '原物料' }
    const columns: DataGridColumn<DataGridRow>[] = [{ field: 'name', title: '名称' }]
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 0,
      endColumnIndex: 0,
      columns: [{ getColId: () => 'name' }],
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => 1,
      getDisplayedRowAtIndex: (displayIndex: number) =>
        displayIndex === 0 ? { data: row } : undefined,
    } as unknown as GridApi<DataGridRow>
    const selectRange = vi.fn()
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange,
            getConfig: () => ({
              overflow: 'append',
              createRow: ({ appendIndex }) => ({ id: appendIndex + 2, name: '' }),
              errorHandling: { cellErrorMode: 'skipRow' },
            }),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => [row],
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (currentRow) => resolveDataGridRowKey(currentRow),
            hasStableRowKey: () => true,
            findDataIndex: () => 0,
            isCellMerged: () => false,
            isCellInteractionBlocked: (rowKey) => rowKey === 2,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow, changes) => ({
              ...previousRow,
              ...Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
            }),
            commitChanges: commitPendingChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError: vi.fn(),
            onClipboardError: vi.fn(),
            onPasteFeedback: vi.fn(),
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('修改原物料\n跳过追加行\n保留追加行')).resolves.toBe(true)
    expect(onPaste.mock.calls[0][0]).toMatchObject({
      appendedCount: 1,
      skippedRowCount: 1,
    })
    expect(selectRange).toHaveBeenCalledWith(
      { displayIndex: 0, columnId: 'name' },
      { displayIndex: 1, columnId: 'name' },
    )

    wrapper.unmount()
  })

  it('truncates columns beyond the right table boundary and reports skipped cells', async () => {
    const row = { id: 1, left: '左侧原值', right: '右侧原值' }
    const columns: DataGridColumn<DataGridRow>[] = [
      { field: 'left', title: '左侧' },
      { field: 'right', title: '右侧' },
    ]
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 1,
      endColumnIndex: 1,
      columns: columns.map((column) => ({ getColId: () => column.field })),
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => 1,
      getDisplayedRowAtIndex: () => ({ data: row }),
    } as unknown as GridApi<DataGridRow>
    const reportError = vi.fn()
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange: vi.fn(),
            getConfig: () => ({}),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => [row],
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (currentRow) => resolveDataGridRowKey(currentRow),
            hasStableRowKey: () => true,
            findDataIndex: () => 0,
            isCellMerged: () => false,
            isCellInteractionBlocked: () => false,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow, changes) => ({
              ...previousRow,
              ...Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
            }),
            commitChanges: commitPendingChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError,
            onClipboardError: vi.fn(),
            onPasteFeedback: vi.fn(),
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('右侧新值\t越界值')).resolves.toBe(true)
    expect(onPaste.mock.calls[0][0]).toMatchObject({
      changedCount: 1,
      skippedCellCount: 1,
    })
    expect(onPaste.mock.calls[0][0].changes[0]?.row).toMatchObject({
      left: '左侧原值',
      right: '右侧新值',
    })
    expect(reportError).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('pastes through filtered display rows and appends overflow without changing hidden rows', async () => {
    const firstRow = { id: 1, name: '可见物料一' }
    const hiddenRow = { id: 2, name: '隐藏物料' }
    const thirdRow = { id: 3, name: '可见物料三' }
    const rows = [firstRow, hiddenRow, thirdRow]
    const displayedRows = [firstRow, thirdRow]
    const columns: DataGridColumn<DataGridRow>[] = [{ field: 'name', title: '名称' }]
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 0,
      endColumnIndex: 0,
      columns: [{ getColId: () => 'name' }],
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => displayedRows.length,
      getDisplayedRowAtIndex: (displayIndex: number) => {
        const row = displayedRows[displayIndex]
        return row ? { data: row } : undefined
      },
    } as unknown as GridApi<DataGridRow>
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange: vi.fn(),
            getConfig: () => ({}),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => rows,
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (row) => resolveDataGridRowKey(row),
            hasStableRowKey: () => true,
            findDataIndex: (row) => rows.indexOf(row as typeof firstRow),
            isCellMerged: () => false,
            isCellInteractionBlocked: () => false,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow, changes) => ({
              ...previousRow,
              ...Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
            }),
            commitChanges: commitPendingChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError: vi.fn(),
            onClipboardError: vi.fn(),
            onPasteFeedback: vi.fn(),
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('修改可见一\n修改可见三\n新增物料')).resolves.toBe(true)
    const payload = onPaste.mock.calls[0][0]
    expect(payload.changes.map((change) => change.dataIndex)).toEqual([0, 2, 3])
    expect(payload.changes.map((change) => change.row.name)).toEqual([
      '修改可见一',
      '修改可见三',
      '新增物料',
    ])
    expect(hiddenRow).toEqual({ id: 2, name: '隐藏物料' })
    expect(payload.appendedRows[0]).toMatchObject({ name: '新增物料' })
    expect(payload.appendedCount).toBe(1)
    expect(payload.changedCount).toBe(3)
    wrapper.unmount()
  })

  it('pastes into columns without an editor and columns whose editors are readonly', async () => {
    const row: DataGridRow = {
      id: 1,
      withoutEditor: '原值1',
      editorFalse: '原值2',
      staticReadonly: 1,
      dynamicReadonly: 2,
    }
    const columns: DataGridColumn<DataGridRow>[] = [
      { field: 'withoutEditor', title: '无编辑器' },
      { field: 'editorFalse', title: '关闭编辑器', editor: false },
      { field: 'staticReadonly', title: '静态只读', editor: { type: 'number', editable: false } },
      {
        field: 'dynamicReadonly',
        title: '动态只读',
        editor: { type: 'number', editable: () => false },
      },
    ]
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 0,
      endColumnIndex: 3,
      columns: columns.map((column) => ({ getColId: () => column.field })),
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => 1,
      getDisplayedRowAtIndex: () => ({ data: row }),
    } as unknown as GridApi<DataGridRow>
    const reportError = vi.fn()
    const onPasteFeedback = vi.fn()
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    const commitChanges = vi.fn(commitPendingChanges)
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange: vi.fn(),
            getConfig: () => ({}),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => [row],
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (currentRow) => resolveDataGridRowKey(currentRow),
            hasStableRowKey: () => true,
            findDataIndex: () => 0,
            isCellMerged: () => false,
            isCellInteractionBlocked: () => false,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow) => previousRow,
            commitChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError,
            onClipboardError: vi.fn(),
            onPasteFeedback,
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('新值1\t新值2\t12.5\t14.5')).resolves.toBe(true)
    const pastePayload = onPaste.mock.calls[0][0]
    const pastedRow = pastePayload.changes[pastePayload.changes.length - 1]?.row
    expect(pastedRow).toMatchObject({
      withoutEditor: '新值1',
      editorFalse: '新值2',
      staticReadonly: 12.5,
      dynamicReadonly: 14.5,
    })
    expect(pastePayload.skippedCellCount).toBe(0)
    expect(reportError).not.toHaveBeenCalled()
    expect(onPasteFeedback).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('keeps rectangular column positions when clipboard-disabled and merged cells are skipped', async () => {
    const row: DataGridRow = {
      id: 1,
      clipboardDisabled: '保留1',
      pasteDisabled: '保留2',
      merged: '保留3',
      allowed: '原值4',
    }
    const columns: DataGridColumn<DataGridRow>[] = [
      { field: 'clipboardDisabled', title: '关闭剪贴板', clipboard: false },
      { field: 'pasteDisabled', title: '关闭粘贴', clipboard: { paste: false } },
      { field: 'merged', title: '合并区域' },
      { field: 'allowed', title: '允许粘贴' },
    ]
    const bounds = {
      startDisplayIndex: 0,
      endDisplayIndex: 0,
      startColumnIndex: 0,
      endColumnIndex: 3,
      columns: columns.map((column) => ({ getColId: () => column.field })),
    } as unknown as DataGridSelectionBounds
    const api = {
      stopEditing: vi.fn(),
      getDisplayedRowCount: () => 1,
      getDisplayedRowAtIndex: () => ({ data: row }),
    } as unknown as GridApi<DataGridRow>
    const onPaste = vi.fn<(payload: DataGridClipboardPastePayload<DataGridRow>) => void>()
    const onPasteFeedback = vi.fn()
    let pasteText: (text: string) => Promise<boolean> = async () => false
    const wrapper = mount(
      defineComponent({
        setup() {
          pasteText = useDataGridPaste<DataGridRow>({
            getApi: () => api,
            getBounds: () => bounds,
            getSelectionRange: () => undefined,
            selectRange: vi.fn(),
            getConfig: () => ({}),
            getMode: () => 'edit',
            isDisabled: () => false,
            isLoading: () => false,
            getRows: () => [row],
            getColumns: () => columns,
            getValidationConcurrency: () => 1,
            getRowKey: (currentRow) => resolveDataGridRowKey(currentRow),
            hasStableRowKey: () => true,
            findDataIndex: () => 0,
            isCellMerged: (_displayIndex, field) => field === 'merged',
            isCellInteractionBlocked: () => false,
            startCellLoading: () => ({ finish: vi.fn() }),
            createCandidateRow: (previousRow, changes) => ({
              ...previousRow,
              ...Object.fromEntries(changes.map((change) => [change.field, change.newValue])),
            }),
            commitChanges: commitPendingChanges,
            validationManager: {
              abortAll: vi.fn(),
              getErrors: () => [],
              setErrors: vi.fn(),
              validateCandidate: async () => [],
            },
            reportError: vi.fn(),
            onClipboardError: vi.fn(),
            onPasteFeedback,
            onPaste,
          }).pasteText
          return () => h('div')
        },
      }),
    )

    await expect(pasteText('忽略1\t忽略2\t忽略3\t新值4')).resolves.toBe(true)
    const pastePayload = onPaste.mock.calls[0][0]
    expect(pastePayload.changes).toHaveLength(1)
    expect(pastePayload.changes[0]).toMatchObject({
      field: 'allowed',
      newValue: '新值4',
    })
    expect(pastePayload.changes[0].row).toMatchObject({
      clipboardDisabled: '保留1',
      pasteDisabled: '保留2',
      merged: '保留3',
      allowed: '新值4',
    })
    expect(pastePayload.skippedCellCount).toBe(3)

    columns[3].clipboard = false
    await expect(pasteText('忽略1\t忽略2\t忽略3\t忽略4')).resolves.toBe(false)
    expect(onPasteFeedback).toHaveBeenCalledWith('warning', '选区内没有可粘贴的单元格')
    expect(onPaste).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
