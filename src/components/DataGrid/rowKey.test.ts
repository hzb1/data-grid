import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  DATA_GRID_ROW_KEY_FIELD,
  createDataGridRowIdentity,
  createDataGridRowKey,
  createDataGridRowKeySnapshot,
  encodeDataGridRowKey,
  resolveDataGridRowKey,
} from './rowKey'

describe('DataGrid rowKey', () => {
  it('按兼容 id 和显式配置解析业务标识', () => {
    expect(resolveDataGridRowKey({ __dataGridRowKey: 'frontend-1', id: 1 })).toBe(1)
    expect(resolveDataGridRowKey({ __dataGridRowKey: 'frontend-1' }, DATA_GRID_ROW_KEY_FIELD)).toBe(
      'frontend-1',
    )
    expect(resolveDataGridRowKey({ id: 2 })).toBe(2)
    expect(resolveDataGridRowKey({ code: 'M-1' }, 'code')).toBe('M-1')
    expect(resolveDataGridRowKey({ code: 'M-2' }, (row) => row.code)).toBe('M-2')
  })

  it('不会在业务对象上生成公开默认字段', () => {
    const row = { name: '新增行' }
    const rowKey = resolveDataGridRowKey(row)

    expect(rowKey).toEqual(expect.any(String))
    expect(Object.prototype.hasOwnProperty.call(row, DATA_GRID_ROW_KEY_FIELD)).toBe(false)
    expect(JSON.stringify(row)).toBe('{"name":"新增行"}')
  })

  it('为空值、非法类型和 resolver 异常的行提供不同临时标识', () => {
    const rows = [{ key: '' }, { key: true }, { key: 'throw' }]
    const snapshot = createDataGridRowKeySnapshot(rows, (row) => {
      if (row.key === 'throw') {
        throw new Error('resolver failed')
      }
      return row.key as never
    })

    expect(snapshot.issues).toHaveLength(3)
    expect(new Set(snapshot.entries.map((entry) => entry.rowKey)).size).toBe(3)
    expect(snapshot.entries.every((entry) => entry.generated)).toBe(true)
    expect(snapshot.issues[2].message).toBe('resolver failed')
  })

  it('重复业务标识保留首行业务 key 并为后续行生成稳定私有 key', () => {
    const rows = [{ id: 1 }, { id: 1 }]
    const firstSnapshot = createDataGridRowKeySnapshot(rows, 'id')
    const secondSnapshot = createDataGridRowKeySnapshot(rows, 'id')

    expect(firstSnapshot.issues).toEqual([{ type: 'duplicate', dataIndexes: [0, 1], value: 1 }])
    expect(firstSnapshot.entries[0]).toMatchObject({ rowKey: 1, generated: false })
    expect(firstSnapshot.entries[1].generated).toBe(true)
    expect(firstSnapshot.entries[0].rowKey).not.toBe(firstSnapshot.entries[1].rowKey)
    expect(secondSnapshot.issues).toEqual(firstSnapshot.issues)
    expect(secondSnapshot.entries.map((entry) => entry.rowKey)).toEqual(
      firstSnapshot.entries.map((entry) => entry.rowKey),
    )
  })

  it('区分数字 key 与同文本字符串 key', () => {
    const snapshot = createDataGridRowKeySnapshot([{ id: 1 }, { id: '1' }], 'id')

    expect(snapshot.issues).toEqual([])
    expect(snapshot.entries.map((entry) => entry.rowKey)).toEqual([1, '1'])
  })

  it('不可扩展行也能使用当前对象生命周期内的私有标识', () => {
    const row = Object.freeze({ name: '冻结行' })

    expect(resolveDataGridRowKey(row)).toBe(resolveDataGridRowKey(row))
    expect(Object.prototype.hasOwnProperty.call(row, DATA_GRID_ROW_KEY_FIELD)).toBe(false)
  })

  it('同一逻辑行的不可变更新可以显式继承私有身份', () => {
    const identity = createDataGridRowIdentity<Record<string, unknown>>()
    const sourceRow = { name: '编辑前' }
    const targetRow = { name: '编辑后' }
    const sourceKey = identity.resolve(sourceRow)

    identity.inheritInternalKey(sourceRow, targetRow)

    expect(identity.resolve(targetRow)).toBe(sourceKey)
  })

  it('不同 DataGrid 实例不会共享私有身份容器', () => {
    const row = { name: '同一个业务对象' }
    const firstIdentity = createDataGridRowIdentity<Record<string, unknown>>()
    const secondIdentity = createDataGridRowIdentity<Record<string, unknown>>()

    expect(firstIdentity.resolve(row)).not.toBe(secondIdentity.resolve(row))
  })

  it('Vue 响应式代理与对应原对象共享同一私有身份', () => {
    const row = { name: '临时行' }
    const proxyRow = reactive(row)
    const identity = createDataGridRowIdentity<typeof row>()

    expect(identity.resolve(proxyRow)).toBe(identity.resolve(row))
  })

  it('业务标识快照提供 O(1) 查找索引且不含内部 key', () => {
    const rows = [{ id: 1 }, { id: 2 }]
    const snapshot = createDataGridRowKeySnapshot(rows, 'id')

    expect(snapshot.internalKeys.size).toBe(0)
    rows.forEach((row, index) => {
      const entry = snapshot.entries[index]
      expect(snapshot.rowToEntry.get(row)).toBe(entry)
      expect(snapshot.keyToEntry.get(entry.rowKey)).toBe(entry)
      expect(snapshot.tokenToEntry.get(encodeDataGridRowKey(entry.rowKey))).toBe(entry)
    })
  })

  it('内部临时标识快照同样提供完整查找索引', () => {
    const rows = [{ name: 'a' }, { name: 'b' }]
    const snapshot = createDataGridRowKeySnapshot(rows)

    expect(snapshot.internalKeys.size).toBe(2)
    snapshot.entries.forEach((entry) => {
      expect(entry.generated).toBe(true)
      expect(snapshot.internalKeys.has(entry.rowKey)).toBe(true)
      expect(snapshot.rowToEntry.get(entry.row)).toBe(entry)
      expect(snapshot.keyToEntry.get(entry.rowKey)).toBe(entry)
      expect(snapshot.tokenToEntry.get(encodeDataGridRowKey(entry.rowKey))).toBe(entry)
    })
  })

  it('同一业务对象在多次独立 helper 调用间复用稳定临时标识', () => {
    const row = { name: '临时行' }

    expect(resolveDataGridRowKey(row)).toBe(resolveDataGridRowKey(row))
    expect(createDataGridRowKeySnapshot([row]).entries[0].rowKey).toBe(resolveDataGridRowKey(row))
  })

  it('业务 helper 生成带前缀的唯一标识', () => {
    const firstKey = createDataGridRowKey('material')
    const secondKey = createDataGridRowKey('material')

    expect(firstKey).not.toBe(secondKey)
    expect(String(firstKey)).toContain('data-grid:material:')
  })
})
