/**
 * 工具名称：DataGrid 行唯一标识
 * 使用场景：解析业务行标识，并通过组件实例级 WeakMap 管理异常行的私有临时身份。
 */

import { toRaw } from 'vue'
import type { DataGridRow, DataGridRowKey, DataGridRowKeyResolver } from './types'

/** DataGrid 业务侧可选使用的前端行标识字段名。 */
export const DATA_GRID_ROW_KEY_FIELD = '__dataGridRowKey' as const

/** DataGrid 行标识问题类型。 */
export type DataGridRowKeyIssueType = 'invalid' | 'duplicate'

/** DataGrid 当前数据中的单项行标识问题。 */
export interface DataGridRowKeyIssue {
  /** 当前问题的具体类型。 */
  type: DataGridRowKeyIssueType

  /** 出现问题的业务行下标集合。 */
  dataIndexes: number[]

  /** 当前业务配置解析出的原始标识值。 */
  value?: unknown

  /** 行标识函数执行失败时产生的错误文本。 */
  message?: string
}

/** DataGrid 当前数据中单行使用的有效身份。 */
export interface DataGridRowKeySnapshotEntry<Row extends DataGridRow> {
  /** 当前业务行对象。 */
  row: Row

  /** 当前业务行在受控数组中的下标。 */
  dataIndex: number

  /** 当前行实际提供给表格内部功能的有效标识。 */
  rowKey: DataGridRowKey

  /** 当前有效标识是否由 DataGrid 私下生成。 */
  generated: boolean
}

/** DataGrid 当前完整数据的有效身份快照。 */
export interface DataGridRowKeySnapshot<Row extends DataGridRow> {
  /** 与受控行数组顺序一致的有效身份列表。 */
  entries: DataGridRowKeySnapshotEntry<Row>[]

  /** 当前业务行标识存在的全部问题。 */
  issues: DataGridRowKeyIssue[]

  /** 通过业务行对象查找对应有效身份项；用于 O(1) 引用定位。 */
  rowToEntry: WeakMap<Row, DataGridRowKeySnapshotEntry<Row>>

  /** 通过规范化行标识查找对应有效身份项；用于 O(1) key 定位。 */
  keyToEntry: Map<DataGridRowKey, DataGridRowKeySnapshotEntry<Row>>

  /** 通过 token 查找对应有效身份项；兼容 AG Grid 等需要字符串 ID 的场景。 */
  tokenToEntry: Map<string, DataGridRowKeySnapshotEntry<Row>>

  /** 当前已使用内部临时身份集合，用于跨数据保留选择状态时识别过期 key。 */
  internalKeys: Set<DataGridRowKey>
}

/** DataGrid 单个组件实例使用的行身份管理器。 */
export interface DataGridRowIdentity<Row extends DataGridRow> {
  /** 返回当前行的有效身份，业务标识异常时使用私有临时标识。 */
  resolve: (row: Row, rowKey?: DataGridRowKeyResolver<Row>) => DataGridRowKey

  /** 构建当前完整数据的有效身份快照。 */
  createSnapshot: (rows: Row[], rowKey?: DataGridRowKeyResolver<Row>) => DataGridRowKeySnapshot<Row>

  /** 返回当前行已有的私有身份，尚未生成时返回 undefined。 */
  getInternalKey: (row: Row) => DataGridRowKey | undefined

  /** 返回当前行的私有身份，尚未生成时立即创建。 */
  getOrCreateInternalKey: (row: Row) => DataGridRowKey

  /** 将同一逻辑行的私有身份继承给不可变更新产生的新对象。 */
  inheritInternalKey: (source: Row, target: Row) => void

  /** 判断有效身份是否为当前实例给指定行生成的私有身份。 */
  isInternalKey: (row: Row, rowKey: DataGridRowKey) => boolean
}

/** DataGrid 内部解析出的单行业务标识候选。 */
interface DataGridRowKeyCandidate<Row extends DataGridRow> {
  /** 当前业务行对象。 */
  row: Row

  /** 当前业务行在受控数组中的下标。 */
  dataIndex: number

  /** 当前业务配置解析出的原始标识值。 */
  value?: unknown

  /** 当前业务标识函数执行失败时产生的错误文本。 */
  message?: string
}

let generatedRowKeySequence = 0

/** 判断值是否为合法的 DataGrid 行标识。 */
export function isDataGridRowKey(value: unknown): value is DataGridRowKey {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  )
}

/** 将行标识转换为 AG Grid 使用且能够区分值类型的字符串 ID。 */
export function encodeDataGridRowKey(rowKey: DataGridRowKey) {
  return `${typeof rowKey}:${String(rowKey)}`
}

/** 创建前端生命周期内唯一的 DataGrid 行标识。 */
export function createDataGridRowKey(prefix = 'row'): DataGridRowKey {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `data-grid:${prefix}:${crypto.randomUUID()}`
  }
  generatedRowKeySequence += 1
  return `data-grid:${prefix}:${Date.now().toString(36)}-${generatedRowKeySequence.toString(36)}`
}

/** 返回未知异常适合写入诊断信息的简短文本。 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** 读取显式 rowKey；未配置时兼容读取 id。 */
export function resolveDataGridBusinessRowKey<Row extends DataGridRow>(
  row: Row,
  rowKey?: DataGridRowKeyResolver<Row>,
) {
  if (typeof rowKey === 'function') {
    return rowKey(row)
  }
  if (typeof rowKey === 'string') {
    return row[rowKey]
  }
  return row.id
}

/** 解析单行候选标识，同时保留业务解析问题供诊断使用。 */
function resolveCandidate<Row extends DataGridRow>(
  row: Row,
  dataIndex: number,
  rowKey?: DataGridRowKeyResolver<Row>,
): DataGridRowKeyCandidate<Row> {
  try {
    return { row, dataIndex, value: resolveDataGridBusinessRowKey(row, rowKey) }
  } catch (error) {
    return { row, dataIndex, message: getErrorMessage(error) }
  }
}

/** 创建 DataGrid 单个组件实例使用的私有行身份管理器。 */
export function createDataGridRowIdentity<Row extends DataGridRow>(): DataGridRowIdentity<Row> {
  const internalKeys = new WeakMap<Row, DataGridRowKey>()

  function getIdentityTarget(row: Row) {
    return toRaw(row) as Row
  }

  function assignInternalKey(row: Row) {
    const rowKey = createDataGridRowKey('internal')
    internalKeys.set(getIdentityTarget(row), rowKey)
    return rowKey
  }

  function getInternalKey(row: Row) {
    return internalKeys.get(getIdentityTarget(row))
  }

  function getOrCreateInternalKey(row: Row) {
    return getInternalKey(row) ?? assignInternalKey(row)
  }

  function inheritInternalKey(source: Row, target: Row) {
    const rowKey = getInternalKey(source)
    if (rowKey !== undefined) {
      internalKeys.set(getIdentityTarget(target), rowKey)
    }
  }

  function isInternalKey(row: Row, rowKey: DataGridRowKey) {
    return Object.is(getInternalKey(row), rowKey)
  }

  function resolve(row: Row, rowKey?: DataGridRowKeyResolver<Row>) {
    try {
      const candidate = resolveDataGridBusinessRowKey(row, rowKey)
      return isDataGridRowKey(candidate) ? candidate : getOrCreateInternalKey(row)
    } catch {
      return getOrCreateInternalKey(row)
    }
  }

  function createSnapshot(
    rows: Row[],
    rowKey?: DataGridRowKeyResolver<Row>,
  ): DataGridRowKeySnapshot<Row> {
    const candidates = rows.map((row, dataIndex) => resolveCandidate(row, dataIndex, rowKey))
    const tokenCandidates = new Map<string, DataGridRowKeyCandidate<Row>[]>()
    const issues: DataGridRowKeyIssue[] = []

    candidates.forEach((candidate) => {
      if (!isDataGridRowKey(candidate.value)) {
        issues.push({
          type: 'invalid',
          dataIndexes: [candidate.dataIndex],
          value: candidate.value,
          message: candidate.message,
        })
        return
      }
      const token = encodeDataGridRowKey(candidate.value)
      const groupedCandidates = tokenCandidates.get(token) ?? []
      groupedCandidates.push(candidate)
      tokenCandidates.set(token, groupedCandidates)
    })

    const duplicateFallbackIndexes = new Set<number>()
    tokenCandidates.forEach((groupedCandidates) => {
      if (groupedCandidates.length < 2) {
        return
      }
      const dataIndexes = groupedCandidates.map((candidate) => candidate.dataIndex)
      // 保留重复组首行原有的业务标识，避免新增副本后让已渲染源行的 AG Grid id 发生漂移。
      dataIndexes.slice(1).forEach((dataIndex) => duplicateFallbackIndexes.add(dataIndex))
      issues.push({
        type: 'duplicate',
        dataIndexes,
        value: groupedCandidates[0].value,
      })
    })

    const usedTokens = new Set(
      candidates.flatMap((candidate) =>
        isDataGridRowKey(candidate.value) && !duplicateFallbackIndexes.has(candidate.dataIndex)
          ? [encodeDataGridRowKey(candidate.value)]
          : [],
      ),
    )
    const entries: DataGridRowKeySnapshotEntry<Row>[] = []
    const rowToEntry = new WeakMap<Row, DataGridRowKeySnapshotEntry<Row>>()
    const keyToEntry = new Map<DataGridRowKey, DataGridRowKeySnapshotEntry<Row>>()
    const tokenToEntry = new Map<string, DataGridRowKeySnapshotEntry<Row>>()
    const internalKeys = new Set<DataGridRowKey>()

    candidates.forEach((candidate) => {
      const businessKey =
        isDataGridRowKey(candidate.value) && !duplicateFallbackIndexes.has(candidate.dataIndex)
          ? candidate.value
          : undefined
      let entry: DataGridRowKeySnapshotEntry<Row>
      if (businessKey !== undefined) {
        entry = {
          row: candidate.row,
          dataIndex: candidate.dataIndex,
          rowKey: businessKey,
          generated: false,
        }
      } else {
        let internalKey = getOrCreateInternalKey(candidate.row)
        while (usedTokens.has(encodeDataGridRowKey(internalKey))) {
          internalKey = assignInternalKey(candidate.row)
        }
        usedTokens.add(encodeDataGridRowKey(internalKey))
        internalKeys.add(internalKey)
        entry = {
          row: candidate.row,
          dataIndex: candidate.dataIndex,
          rowKey: internalKey,
          generated: true,
        }
      }
      entries.push(entry)
      rowToEntry.set(candidate.row, entry)
      keyToEntry.set(entry.rowKey, entry)
      tokenToEntry.set(encodeDataGridRowKey(entry.rowKey), entry)
    })

    return { entries, issues, rowToEntry, keyToEntry, tokenToEntry, internalKeys }
  }

  return {
    resolve,
    createSnapshot,
    getInternalKey,
    getOrCreateInternalKey,
    inheritInternalKey,
    isInternalKey,
  }
}

/** 兼容 helper 使用的共享身份管理器，保证同一业务对象在多次独立调用间拿到稳定的临时标识。 */
const compatibilityIdentity = createDataGridRowIdentity<DataGridRow>()

/** 构建独立工具调用使用的有效身份快照；同一业务对象在多次调用间复用稳定的临时标识。 */
export function createDataGridRowKeySnapshot<Row extends DataGridRow>(
  rows: Row[],
  rowKey?: DataGridRowKeyResolver<Row>,
): DataGridRowKeySnapshot<Row> {
  return compatibilityIdentity.createSnapshot(
    rows,
    rowKey as DataGridRowKeyResolver<DataGridRow>,
  ) as DataGridRowKeySnapshot<Row>
}

/** 解析独立工具调用中的单行标识；同一业务对象在多次调用间复用稳定的临时标识。 */
export function resolveDataGridRowKey<Row extends DataGridRow>(
  row: Row,
  rowKey?: DataGridRowKeyResolver<Row>,
) {
  return compatibilityIdentity.resolve(row, rowKey as DataGridRowKeyResolver<DataGridRow>)
}
