import type { DataGridColumnSettingStorageDriver } from './types'

/** DataGrid 默认写入 localStorage 时使用的物理键前缀。 */
const DEFAULT_DATA_GRID_STORAGE_PREFIX = '@hzb-ui/'

/** 创建使用指定键前缀的 DataGrid localStorage 存储驱动。 */
export function createDataGridLocalStorageDriver(
  prefix = DEFAULT_DATA_GRID_STORAGE_PREFIX,
): DataGridColumnSettingStorageDriver {
  function getStorage() {
    return window.localStorage
  }

  function toPhysicalKey(key: string) {
    return `${prefix}${key}`
  }

  return {
    get(key) {
      return getStorage().getItem(toPhysicalKey(key))
    },
    set(key, value) {
      getStorage().setItem(toPhysicalKey(key), value)
    },
    remove(key) {
      getStorage().removeItem(toPhysicalKey(key))
    },
    keys(namespace) {
      const storage = getStorage()
      const physicalNamespace = toPhysicalKey(namespace)
      const keys: string[] = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key?.startsWith(physicalNamespace)) {
          keys.push(key.slice(prefix.length))
        }
      }
      return keys
    },
  }
}
