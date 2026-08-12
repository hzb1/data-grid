/**
 * @hzb-ui/data-grid 公共入口。
 * 仅导出稳定组件、公共类型、辅助函数和宿主适配能力。
 */

export { default as DataGrid } from './components/DataGrid/DataGrid.vue'
export * from './components/DataGrid/types'
export { createDataGridRowKey, DATA_GRID_ROW_KEY_FIELD } from './components/DataGrid/rowKey'
export { dataGridClipboardParsers } from './components/DataGrid/parsers'
export {
  dataGridMessage,
  type DataGridMessageAdapter,
  type DataGridMessageType,
} from './components/DataGrid/message'
export {
  DataGridPlugin,
  type DataGridPersistenceScope,
  type DataGridPluginOptions,
} from './components/DataGrid/runtimeConfig'
export { createDataGridLocalStorageDriver } from './components/DataGrid/repository/storageDriver'
export type { DataGridColumnSettingStorageDriver } from './components/DataGrid/repository/types'
