/**
 * 组合函数名称：DataGrid 操作历史
 * 使用场景：记录编辑、粘贴、拖动、复制行和删除事务，并提供撤销与重做能力。
 */

import { shallowRef } from 'vue'
import type {
  DataGridChangeSource,
  DataGridHistoryState,
  DataGridRow,
  DataGridRowKey,
  DataGridValueChange,
} from '../types'

/** DataGrid 单元格编辑或粘贴形成的历史记录。 */
export interface DataGridValueHistoryEntry<Row extends DataGridRow> {
  /** 产生记录的数据操作来源。 */
  source: Extract<DataGridChangeSource, 'edit' | 'paste'>

  /** 本次事务包含的字段值变化。 */
  changes: DataGridValueChange<Row>[]

  /** 本次粘贴事务自动追加的行。 */
  appendedRows?: Row[]
}

/** DataGrid 行拖动形成的历史记录。 */
export interface DataGridReorderHistoryEntry {
  /** 行拖动历史记录的固定来源。 */
  source: 'drag'

  /** 拖动前的行标识顺序。 */
  beforeRowKeys: Array<string | number>

  /** 拖动后的行标识顺序。 */
  afterRowKeys: Array<string | number>
}

/** DataGrid 复制行形成的历史记录。 */
export interface DataGridCopyHistoryEntry<Row extends DataGridRow> {
  /** 复制行历史记录的固定来源。 */
  source: 'copy'

  /** 新增行在复制后受控数组中的起始位置。 */
  insertDataIndex: number

  /** 复制源行的稳定唯一标识。 */
  sourceRowKey: DataGridRowKey

  /** 本次复制生成的全部副本。 */
  insertedRows: Row[]
}

/** DataGrid 删除历史中单条被移除的业务行。 */
export interface DataGridRemovedRowHistoryItem<Row extends DataGridRow> {
  /** 被删除的完整业务行。 */
  row: Row

  /** 被删除行的稳定唯一标识。 */
  rowKey: DataGridRowKey

  /** 被删除行在删除前受控数组中的位置。 */
  dataIndex: number
}

/** DataGrid 删除选中行形成的历史记录。 */
export interface DataGridRemoveHistoryEntry<Row extends DataGridRow> {
  /** 删除选中行历史记录的固定来源。 */
  source: 'remove'

  /** 本次删除的全部业务行及其原始位置。 */
  removedItems: DataGridRemovedRowHistoryItem<Row>[]
}

/** DataGrid 可撤销和重做的历史记录。 */
export type DataGridHistoryEntry<Row extends DataGridRow> =
  | DataGridValueHistoryEntry<Row>
  | DataGridReorderHistoryEntry
  | DataGridCopyHistoryEntry<Row>
  | DataGridRemoveHistoryEntry<Row>

/**
 * 管理 DataGrid 的字段差异历史栈。
 * 只负责事务入栈、出栈和状态通知，不直接修改表格数据。
 */
export function useDataGridHistory<Row extends DataGridRow>(
  getLimit: () => number,
  onChange: (state: DataGridHistoryState) => void,
) {
  const undoStack = shallowRef<DataGridHistoryEntry<Row>[]>([])
  const redoStack = shallowRef<DataGridHistoryEntry<Row>[]>([])

  function getState(): DataGridHistoryState {
    return {
      undoSize: undoStack.value.length,
      redoSize: redoStack.value.length,
      canUndo: undoStack.value.length > 0,
      canRedo: redoStack.value.length > 0,
    }
  }

  function notify() {
    onChange(getState())
  }

  function push(entry: DataGridHistoryEntry<Row>) {
    undoStack.value = [...undoStack.value, entry]
    const limit = Math.max(1, getLimit())
    if (undoStack.value.length > limit) {
      undoStack.value = undoStack.value.slice(undoStack.value.length - limit)
    }
    redoStack.value = []
    notify()
  }

  function takeUndo() {
    const entry = undoStack.value.at(-1)
    if (entry) {
      undoStack.value = undoStack.value.slice(0, -1)
      redoStack.value = [...redoStack.value, entry]
      notify()
    }
    return entry
  }

  function takeRedo() {
    const entry = redoStack.value.at(-1)
    if (entry) {
      redoStack.value = redoStack.value.slice(0, -1)
      undoStack.value = [...undoStack.value, entry]
      notify()
    }
    return entry
  }

  function clear() {
    if (!undoStack.value.length && !redoStack.value.length) {
      return
    }
    undoStack.value = []
    redoStack.value = []
    notify()
  }

  return {
    push,
    takeUndo,
    takeRedo,
    clear,
    getState,
  }
}
