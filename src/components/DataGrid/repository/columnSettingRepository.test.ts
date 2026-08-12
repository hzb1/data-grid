import { describe, expect, it } from 'vitest'
import {
  createDataGridColumnSettingRepository,
  DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL,
  DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
  DATA_GRID_COLUMN_SETTING_EXPIRE_TIME,
  DATA_GRID_COLUMN_SETTING_NAMESPACE,
} from './columnSettingRepository'
import type { DataGridColumnSettingCache, DataGridColumnSettingStorageDriver } from './types'

const COLUMN_DATA = {
  overrides: {
    order: ['name'],
    columns: [
      {
        field: 'name',
        width: 160,
        flex: null,
      },
    ],
  },
}

function createMemoryDriver(initialEntries: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initialEntries))
  let setCount = 0
  let keysCount = 0
  const driver: DataGridColumnSettingStorageDriver = {
    get(key) {
      return entries.get(key) ?? null
    },
    set(key, value) {
      setCount += 1
      entries.set(key, value)
    },
    remove(key) {
      entries.delete(key)
    },
    keys(namespace) {
      keysCount += 1
      return [...entries.keys()].filter((key) => key.startsWith(namespace))
    },
  }
  return {
    driver,
    entries,
    getSetCount: () => setCount,
    getKeysCount: () => keysCount,
  }
}

function createCache(timestamp: number, revision = 1): DataGridColumnSettingCache {
  return {
    version: DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
    revision,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastAccessAt: timestamp,
    data: COLUMN_DATA,
  }
}

describe('DataGrid column setting repository', () => {
  it('writes the complete cache envelope and preserves createdAt on later updates', () => {
    let currentTime = 1_000_000
    const memory = createMemoryDriver()
    const repository = createDataGridColumnSettingRepository({
      driver: memory.driver,
      now: () => currentTime,
    })
    const storageKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}tenant:user:orders`

    expect(repository.set({ storageKey, revision: 3, data: COLUMN_DATA }).ok).toBe(true)
    currentTime += 5_000
    expect(repository.set({ storageKey, revision: 3, data: COLUMN_DATA }).ok).toBe(true)

    const cache = JSON.parse(memory.entries.get(storageKey) || '') as DataGridColumnSettingCache
    expect(cache).toMatchObject({
      version: DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
      revision: 3,
      createdAt: 1_000_000,
      updatedAt: 1_005_000,
      lastAccessAt: 1_005_000,
      data: COLUMN_DATA,
    })
  })

  it('deletes malformed, structurally invalid, version-incompatible and revision-incompatible caches', () => {
    const now = 10_000_000
    const malformedKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}malformed`
    const invalidKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}invalid`
    const versionKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}version`
    const revisionKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}revision`
    const memory = createMemoryDriver({
      [malformedKey]: '{"version":',
      [invalidKey]: JSON.stringify({
        ...createCache(now),
        data: { overrides: { columns: 'invalid' } },
      }),
      [versionKey]: JSON.stringify({ ...createCache(now), version: 1 }),
      [revisionKey]: JSON.stringify(createCache(now, 2)),
    })
    const repository = createDataGridColumnSettingRepository({
      driver: memory.driver,
      now: () => now,
    })

    expect(repository.get({ storageKey: malformedKey, revision: 1 }).status).toBe('invalid')
    expect(repository.get({ storageKey: invalidKey, revision: 1 }).status).toBe('invalid')
    expect(repository.get({ storageKey: versionKey, revision: 1 }).status).toBe(
      'version-incompatible',
    )
    expect(repository.get({ storageKey: revisionKey, revision: 1 }).status).toBe(
      'revision-incompatible',
    )
    expect(memory.entries.size).toBe(0)
  })

  it('expires caches after 180 days and throttles lastAccessAt writes to once per day', () => {
    const now = 200 * 24 * 60 * 60 * 1000
    const recentKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}recent`
    const touchKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}touch`
    const expiredKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}expired`
    const memory = createMemoryDriver({
      [recentKey]: JSON.stringify(
        createCache(now - DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL + 1),
      ),
      [touchKey]: JSON.stringify(
        createCache(now - DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL),
      ),
      [expiredKey]: JSON.stringify(createCache(now - DATA_GRID_COLUMN_SETTING_EXPIRE_TIME - 1)),
    })
    const repository = createDataGridColumnSettingRepository({
      driver: memory.driver,
      now: () => now,
    })

    expect(repository.get({ storageKey: recentKey, revision: 1 }).status).toBe('hit')
    expect(memory.getSetCount()).toBe(0)
    expect(repository.get({ storageKey: touchKey, revision: 1 }).cache?.lastAccessAt).toBe(now)
    expect(memory.getSetCount()).toBe(1)
    expect(repository.get({ storageKey: expiredKey, revision: 1 }).status).toBe('expired')
    expect(memory.entries.has(expiredKey)).toBe(false)
  })

  it('cleans once per page lifecycle and evicts 201 valid caches down to 160 by LRU order', () => {
    const now = 200 * 24 * 60 * 60 * 1000
    const entries: Record<string, string> = {}
    for (let index = 0; index < 201; index += 1) {
      const key = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}${index.toString().padStart(3, '0')}`
      entries[key] = JSON.stringify(createCache(now - index * 1_000))
    }
    const memory = createMemoryDriver(entries)
    const repository = createDataGridColumnSettingRepository({
      driver: memory.driver,
      now: () => now,
    })

    const firstCleanup = repository.cleanupOnce()
    const secondCleanup = repository.cleanupOnce()

    expect(firstCleanup.lruCount).toBe(41)
    expect(memory.entries.size).toBe(160)
    expect(memory.entries.has(`${DATA_GRID_COLUMN_SETTING_NAMESPACE}000`)).toBe(true)
    expect(memory.entries.has(`${DATA_GRID_COLUMN_SETTING_NAMESPACE}200`)).toBe(false)
    expect(secondCleanup.skipped).toBe(true)
    expect(memory.getKeysCount()).toBe(1)
  })

  it('returns safe failure results when the storage driver is unavailable', () => {
    const storageError = new Error('storage unavailable')
    const driver: DataGridColumnSettingStorageDriver = {
      get() {
        throw storageError
      },
      set() {
        throw storageError
      },
      remove() {
        throw storageError
      },
      keys() {
        throw storageError
      },
    }
    const repository = createDataGridColumnSettingRepository({
      driver,
      now: () => 1_000_000,
    })
    const storageKey = `${DATA_GRID_COLUMN_SETTING_NAMESPACE}error`

    expect(repository.get({ storageKey, revision: 1 })).toMatchObject({
      status: 'storage-error',
      error: storageError,
    })
    expect(repository.set({ storageKey, revision: 1, data: COLUMN_DATA })).toMatchObject({
      ok: false,
      error: storageError,
    })
    expect(repository.remove(storageKey)).toMatchObject({ ok: false, error: storageError })
    expect(repository.cleanupOnce().errors).toEqual([storageError])
  })
})
