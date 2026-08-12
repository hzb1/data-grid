import type { DataGridColumnSettingOverrides } from '../types'

/** DataGrid 列配置缓存中持久化的业务数据。 */
export interface DataGridColumnSettingCacheData {
  /** 用户主动修改后形成的稀疏列配置覆盖项。 */
  overrides: DataGridColumnSettingOverrides
}

/** DataGrid 写入本地存储的完整列配置缓存。 */
export interface DataGridColumnSettingCache {
  /** DataGrid 维护的缓存结构版本。 */
  version: number

  /** 业务维护的配置修订号。 */
  revision: number

  /** 缓存首次创建时间。 */
  createdAt: number

  /** 用户最后修改列配置的时间。 */
  updatedAt: number

  /** 缓存最近一次成功读取的时间。 */
  lastAccessAt: number

  /** 实际持久化的列配置数据。 */
  data: DataGridColumnSettingCacheData
}

/** DataGrid 列配置仓储使用的字符串存储驱动。 */
export interface DataGridColumnSettingStorageDriver {
  /** 读取指定逻辑缓存键对应的原始字符串。 */
  get: (key: string) => string | null

  /** 写入指定逻辑缓存键对应的原始字符串。 */
  set: (key: string, value: string) => void

  /** 删除指定逻辑缓存键。 */
  remove: (key: string) => void

  /** 列举指定命名空间下的全部逻辑缓存键。 */
  keys: (namespace: string) => string[]
}

/** DataGrid 列配置缓存读取结果的状态。 */
export type DataGridColumnSettingReadStatus =
  | 'hit'
  | 'miss'
  | 'invalid'
  | 'version-incompatible'
  | 'revision-incompatible'
  | 'expired'
  | 'storage-error'

/** DataGrid 列配置缓存的读取结果。 */
export interface DataGridColumnSettingReadResult {
  /** 本次读取的处理状态。 */
  status: DataGridColumnSettingReadStatus

  /** 成功命中时返回的完整缓存。 */
  cache?: DataGridColumnSettingCache

  /** 不兼容缓存中实际读取到的结构版本。 */
  cacheVersion?: unknown

  /** 不兼容缓存中实际读取到的业务修订号。 */
  cacheRevision?: unknown

  /** 存储访问或访问时间回写失败时捕获的异常。 */
  error?: unknown
}

/** DataGrid 列配置缓存写入或删除结果。 */
export interface DataGridColumnSettingMutationResult {
  /** 本次存储变更是否成功。 */
  ok: boolean

  /** 存储变更失败时捕获的异常。 */
  error?: unknown
}

/** DataGrid 列配置全局清理的结果统计。 */
export interface DataGridColumnSettingCleanupResult {
  /** 本次调用是否因当前页面已清理而跳过。 */
  skipped: boolean

  /** 因解析失败或结构无效而删除的数量。 */
  invalidCount: number

  /** 因通用结构版本不兼容而删除的数量。 */
  versionCount: number

  /** 因长期未访问而删除的数量。 */
  expiredCount: number

  /** 因超过全局数量上限而淘汰的数量。 */
  lruCount: number

  /** 清理期间遇到的存储访问异常。 */
  errors: unknown[]
}

/** 创建 DataGrid 列配置仓储时使用的依赖。 */
export interface CreateDataGridColumnSettingRepositoryOptions {
  /** 仓储底层使用的字符串存储驱动。 */
  driver: DataGridColumnSettingStorageDriver

  /** 返回当前时间戳，测试时可注入固定时间。 */
  now?: () => number
}

/** DataGrid 列配置仓储读取参数。 */
export interface DataGridColumnSettingGetOptions {
  /** 完整的用户级列配置缓存键。 */
  storageKey: string

  /** 当前业务表格要求的配置修订号。 */
  revision: number
}

/** DataGrid 列配置仓储写入参数。 */
export interface DataGridColumnSettingSetOptions extends DataGridColumnSettingGetOptions {
  /** 当前需要持久化的列配置业务数据。 */
  data: DataGridColumnSettingCacheData
}

/** DataGrid 列配置仓储对外提供的操作。 */
export interface DataGridColumnSettingRepository {
  /** 读取并校验当前表格的持久化列配置。 */
  get: (options: DataGridColumnSettingGetOptions) => DataGridColumnSettingReadResult

  /** 写入当前表格的用户列配置覆盖项。 */
  set: (options: DataGridColumnSettingSetOptions) => DataGridColumnSettingMutationResult

  /** 删除指定表格的持久化列配置。 */
  remove: (storageKey: string) => DataGridColumnSettingMutationResult

  /** 在当前页面生命周期内最多执行一次全局缓存清理。 */
  cleanupOnce: () => DataGridColumnSettingCleanupResult
}
