/**
 * DataGrid 运行时配置。
 * 用于为独立组件库注入列配置存储、租户用户作用域和消息反馈能力。
 */

import type { App, InjectionKey } from 'vue'
import { inject } from 'vue'
import type { DataGridMessageAdapter } from './message'
import { dataGridMessage } from './message'
import { createDataGridLocalStorageDriver } from './repository/storageDriver'
import type { DataGridColumnSettingStorageDriver } from './repository/types'

/** DataGrid 持久化数据使用的业务隔离作用域。 */
export interface DataGridPersistenceScope {
  /** 当前租户标识；未提供时使用 `default`。 */
  tenantId?: string | number

  /** 当前用户标识；未提供时使用 `anonymous`。 */
  userId?: string | number
}

/** 安装 DataGrid 插件时可注入的运行时能力。 */
export interface DataGridPluginOptions {
  /** 列配置持久化使用的存储驱动。 */
  storageDriver?: DataGridColumnSettingStorageDriver

  /** 返回当前列配置应使用的租户和用户隔离作用域。 */
  resolvePersistenceScope?: () => DataGridPersistenceScope

  /** DataGrid 操作反馈使用的消息适配器。 */
  messageAdapter?: DataGridMessageAdapter
}

/** DataGrid 组件内部已经补齐默认值的运行时配置。 */
export interface DataGridRuntimeConfig {
  /** 列配置持久化使用的存储驱动。 */
  storageDriver: DataGridColumnSettingStorageDriver

  /** 返回当前列配置应使用的租户和用户隔离作用域。 */
  resolvePersistenceScope: () => DataGridPersistenceScope

  /** 当前 Vue 应用中的 DataGrid 操作反馈适配器。 */
  messageAdapter: DataGridMessageAdapter
}

/** DataGrid 运行时配置的 Vue 注入标识。 */
const DATA_GRID_RUNTIME_CONFIG_KEY: InjectionKey<DataGridRuntimeConfig> = Symbol(
  '@hzb-ui/data-grid/runtime-config',
)

/** 不安装插件时使用的浏览器默认配置。 */
const defaultRuntimeConfig: DataGridRuntimeConfig = {
  storageDriver: createDataGridLocalStorageDriver(),
  resolvePersistenceScope: () => ({}),
  messageAdapter: dataGridMessage,
}

/** 创建已经补齐默认值的 DataGrid 运行时配置。 */
function createDataGridRuntimeConfig(options: DataGridPluginOptions = {}): DataGridRuntimeConfig {
  return {
    storageDriver: options.storageDriver ?? createDataGridLocalStorageDriver(),
    resolvePersistenceScope: options.resolvePersistenceScope ?? (() => ({})),
    messageAdapter: options.messageAdapter ?? dataGridMessage,
  }
}

/** DataGrid 的 Vue 插件，用于集中注入跨实例运行时能力。 */
export const DataGridPlugin = {
  /** 向当前 Vue 应用安装 DataGrid 运行时配置。 */
  install(app: App, options: DataGridPluginOptions = {}) {
    app.provide(DATA_GRID_RUNTIME_CONFIG_KEY, createDataGridRuntimeConfig(options))
  },
}

/** 返回当前组件实例可用的 DataGrid 运行时配置。 */
export function useDataGridRuntimeConfig(): DataGridRuntimeConfig {
  return inject(DATA_GRID_RUNTIME_CONFIG_KEY, defaultRuntimeConfig)
}
