import { getDataGridColumnSettingCacheVersion, parseDataGridColumnSettingCache } from './validator'
import type {
  CreateDataGridColumnSettingRepositoryOptions,
  DataGridColumnSettingCache,
  DataGridColumnSettingCleanupResult,
  DataGridColumnSettingGetOptions,
  DataGridColumnSettingMutationResult,
  DataGridColumnSettingReadResult,
  DataGridColumnSettingRepository,
  DataGridColumnSettingSetOptions,
} from './types'

export const DATA_GRID_COLUMN_SETTING_CACHE_VERSION = 4
export const DATA_GRID_COLUMN_SETTING_NAMESPACE = 'data-grid:columns:'
export const DATA_GRID_COLUMN_SETTING_EXPIRE_TIME = 180 * 24 * 60 * 60 * 1000
export const DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL = 24 * 60 * 60 * 1000
export const DATA_GRID_COLUMN_SETTING_MAX_COUNT = 200
export const DATA_GRID_COLUMN_SETTING_TARGET_COUNT = 160

/** 判断列配置缓存是否已经长期未使用或包含明显异常的未来访问时间。 */
function isExpired(lastAccessAt: number, now: number) {
  return (
    lastAccessAt > now + DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL ||
    now - lastAccessAt > DATA_GRID_COLUMN_SETTING_EXPIRE_TIME
  )
}

/** 创建 DataGrid 专用的列配置缓存仓储。 */
export function createDataGridColumnSettingRepository(
  options: CreateDataGridColumnSettingRepositoryOptions,
): DataGridColumnSettingRepository {
  const now = options.now ?? Date.now
  let hasCleaned = false

  function remove(storageKey: string): DataGridColumnSettingMutationResult {
    try {
      options.driver.remove(storageKey)
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  function parseRawValue(raw: string) {
    try {
      return { value: JSON.parse(raw) as unknown }
    } catch (error) {
      return { error }
    }
  }

  function get({
    storageKey,
    revision,
  }: DataGridColumnSettingGetOptions): DataGridColumnSettingReadResult {
    let raw: string | null
    try {
      raw = options.driver.get(storageKey)
    } catch (error) {
      return { status: 'storage-error', error }
    }
    if (raw === null) {
      return { status: 'miss' }
    }
    const parsedRaw = parseRawValue(raw)
    if (!('value' in parsedRaw)) {
      remove(storageKey)
      return { status: 'invalid', error: parsedRaw.error }
    }
    const cacheVersion = getDataGridColumnSettingCacheVersion(parsedRaw.value)
    if (cacheVersion !== DATA_GRID_COLUMN_SETTING_CACHE_VERSION) {
      remove(storageKey)
      return { status: 'version-incompatible', cacheVersion }
    }
    const cache = parseDataGridColumnSettingCache(parsedRaw.value)
    if (!cache) {
      remove(storageKey)
      return { status: 'invalid' }
    }
    if (cache.revision !== revision) {
      remove(storageKey)
      return { status: 'revision-incompatible', cacheRevision: cache.revision }
    }
    const currentTime = now()
    if (isExpired(cache.lastAccessAt, currentTime)) {
      remove(storageKey)
      return { status: 'expired' }
    }
    if (currentTime - cache.lastAccessAt >= DATA_GRID_COLUMN_SETTING_ACCESS_UPDATE_INTERVAL) {
      const touchedCache: DataGridColumnSettingCache = {
        ...cache,
        lastAccessAt: currentTime,
      }
      try {
        options.driver.set(storageKey, JSON.stringify(touchedCache))
        return { status: 'hit', cache: touchedCache }
      } catch (error) {
        return { status: 'hit', cache, error }
      }
    }
    return { status: 'hit', cache }
  }

  function set({
    storageKey,
    revision,
    data,
  }: DataGridColumnSettingSetOptions): DataGridColumnSettingMutationResult {
    const currentTime = now()
    let createdAt = currentTime
    try {
      const raw = options.driver.get(storageKey)
      if (raw !== null) {
        const parsedRaw = parseRawValue(raw)
        const currentCache =
          'value' in parsedRaw ? parseDataGridColumnSettingCache(parsedRaw.value) : undefined
        if (
          currentCache?.version === DATA_GRID_COLUMN_SETTING_CACHE_VERSION &&
          currentCache.revision === revision
        ) {
          createdAt = currentCache.createdAt
        }
      }
      const cache: DataGridColumnSettingCache = {
        version: DATA_GRID_COLUMN_SETTING_CACHE_VERSION,
        revision,
        createdAt,
        updatedAt: currentTime,
        lastAccessAt: currentTime,
        data,
      }
      options.driver.set(storageKey, JSON.stringify(cache))
      return { ok: true }
    } catch (error) {
      return { ok: false, error }
    }
  }

  function createCleanupResult(skipped: boolean): DataGridColumnSettingCleanupResult {
    return {
      skipped,
      invalidCount: 0,
      versionCount: 0,
      expiredCount: 0,
      lruCount: 0,
      errors: [],
    }
  }

  function cleanupOnce(): DataGridColumnSettingCleanupResult {
    if (hasCleaned) {
      return createCleanupResult(true)
    }
    hasCleaned = true
    const result = createCleanupResult(false)
    let keys: string[]
    try {
      keys = options.driver.keys(DATA_GRID_COLUMN_SETTING_NAMESPACE)
    } catch (error) {
      result.errors.push(error)
      return result
    }
    const currentTime = now()
    const validCaches: { key: string; lastAccessAt: number }[] = []
    keys.forEach((key) => {
      let raw: string | null
      try {
        raw = options.driver.get(key)
      } catch (error) {
        result.errors.push(error)
        return
      }
      if (raw === null) {
        return
      }
      const parsedRaw = parseRawValue(raw)
      if (!('value' in parsedRaw)) {
        const removed = remove(key)
        if (removed.ok) {
          result.invalidCount += 1
        } else {
          result.errors.push(removed.error)
        }
        return
      }
      if (
        getDataGridColumnSettingCacheVersion(parsedRaw.value) !==
        DATA_GRID_COLUMN_SETTING_CACHE_VERSION
      ) {
        const removed = remove(key)
        if (removed.ok) {
          result.versionCount += 1
        } else {
          result.errors.push(removed.error)
        }
        return
      }
      const cache = parseDataGridColumnSettingCache(parsedRaw.value)
      if (!cache) {
        const removed = remove(key)
        if (removed.ok) {
          result.invalidCount += 1
        } else {
          result.errors.push(removed.error)
        }
        return
      }
      if (isExpired(cache.lastAccessAt, currentTime)) {
        const removed = remove(key)
        if (removed.ok) {
          result.expiredCount += 1
        } else {
          result.errors.push(removed.error)
        }
        return
      }
      validCaches.push({ key, lastAccessAt: cache.lastAccessAt })
    })
    if (validCaches.length > DATA_GRID_COLUMN_SETTING_MAX_COUNT) {
      const oldestCaches = validCaches
        .slice()
        .sort(
          (left, right) =>
            left.lastAccessAt - right.lastAccessAt || left.key.localeCompare(right.key),
        )
        .slice(0, validCaches.length - DATA_GRID_COLUMN_SETTING_TARGET_COUNT)
      oldestCaches.forEach(({ key }) => {
        const removed = remove(key)
        if (removed.ok) {
          result.lruCount += 1
        } else {
          result.errors.push(removed.error)
        }
      })
    }
    return result
  }

  return {
    get,
    set,
    remove,
    cleanupOnce,
  }
}
