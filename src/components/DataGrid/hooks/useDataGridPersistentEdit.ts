/**
 * 组合函数名称：DataGrid 常显编辑草稿
 * 使用场景：在虚拟滚动期间按行和字段保存常显输入框的未提交值，并统一提供提交、撤销和清理能力。
 */

import { ref } from 'vue'
import { encodeDataGridRowKey } from '../rowKey'
import type { DataGridRowKey } from '../types'

/** DataGrid 常显输入框保存的单元格草稿。 */
export interface DataGridPersistentDraft {
  /** 当前草稿所属行的稳定唯一标识。 */
  rowKey: DataGridRowKey

  /** 当前草稿对应的业务字段。 */
  field: string

  /** 开始编辑前的业务字段值。 */
  originalValue: unknown

  /** 输入框中尚未提交的最新值。 */
  value: unknown
}

/** DataGrid 常显编辑草稿中心。 */
export interface DataGridPersistentEditManager {
  /** 返回草稿值；当前单元格没有草稿时返回业务原值。 */
  getValue: (rowKey: DataGridRowKey, field: string, sourceValue: unknown) => unknown

  /** 保存当前单元格的最新草稿值。 */
  setValue: (rowKey: DataGridRowKey, field: string, sourceValue: unknown, value: unknown) => void

  /** 返回当前单元格草稿。 */
  getDraft: (rowKey: DataGridRowKey, field: string) => DataGridPersistentDraft | undefined

  /** 返回全部未提交草稿。 */
  getDrafts: () => DataGridPersistentDraft[]

  /** 删除当前单元格草稿。 */
  remove: (rowKey: DataGridRowKey, field: string) => void

  /** 只保留仍然属于当前数据和列的草稿。 */
  prune: (isActive: (draft: DataGridPersistentDraft) => boolean) => void

  /** 清空全部未提交草稿。 */
  clear: () => void
}

/** 生成不会因字段内容包含分隔符而冲突的单元格草稿键。 */
function createDraftKey(rowKey: DataGridRowKey, field: string) {
  return JSON.stringify([encodeDataGridRowKey(rowKey), field])
}

/** 创建 DataGrid 常显输入框的草稿中心。 */
export function useDataGridPersistentEdit(): DataGridPersistentEditManager {
  const drafts = ref<Map<string, DataGridPersistentDraft>>(new Map())

  function getValue(rowKey: DataGridRowKey, field: string, sourceValue: unknown) {
    const draft = drafts.value.get(createDraftKey(rowKey, field))
    return draft ? draft.value : sourceValue
  }

  function setValue(rowKey: DataGridRowKey, field: string, sourceValue: unknown, value: unknown) {
    const key = createDraftKey(rowKey, field)
    const current = drafts.value.get(key)
    const originalValue = current?.originalValue ?? sourceValue
    const nextDrafts = new Map(drafts.value)
    if (Object.is(originalValue, value)) {
      nextDrafts.delete(key)
    } else {
      nextDrafts.set(key, {
        rowKey,
        field,
        originalValue,
        value,
      })
    }
    drafts.value = nextDrafts
  }

  function getDraft(rowKey: DataGridRowKey, field: string) {
    return drafts.value.get(createDraftKey(rowKey, field))
  }

  function getDrafts() {
    return [...drafts.value.values()]
  }

  function remove(rowKey: DataGridRowKey, field: string) {
    const key = createDraftKey(rowKey, field)
    if (!drafts.value.has(key)) {
      return
    }
    const nextDrafts = new Map(drafts.value)
    nextDrafts.delete(key)
    drafts.value = nextDrafts
  }

  function prune(isActive: (draft: DataGridPersistentDraft) => boolean) {
    const nextDrafts = new Map([...drafts.value].filter(([, draft]) => isActive(draft)))
    if (nextDrafts.size !== drafts.value.size) {
      drafts.value = nextDrafts
    }
  }

  function clear() {
    if (drafts.value.size) {
      drafts.value = new Map()
    }
  }

  return {
    getValue,
    setValue,
    getDraft,
    getDrafts,
    remove,
    prune,
    clear,
  }
}
