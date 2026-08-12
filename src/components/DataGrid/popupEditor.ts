import type { DataGridColumn, DataGridEditorConfig, DataGridRow, DataGridRowKey } from './types'

/**
 * DataGrid 浮层编辑器支持的复杂控件类型。
 *
 * - `textarea`：在浮层中编辑多行文本。
 * - `multiSelect`：在浮层中完成多项选择。
 */
export type DataGridPopupEditorType = 'textarea' | 'multiSelect'

/** DataGrid 单元格请求打开共享浮层编辑器时提供的上下文。 */
export interface DataGridPopupEditorContext<Row extends DataGridRow = DataGridRow> {
  /** 浮层定位使用的当前 AG Grid 单元格元素。 */
  anchor: HTMLElement

  /** 当前浮层需要渲染的复杂控件类型。 */
  type: DataGridPopupEditorType

  /** 当前单元格所属的稳定行标识。 */
  rowKey: DataGridRowKey

  /** 当前单元格所属的完整业务行。 */
  row: Row

  /** 当前业务行在原始受控数组中的位置。 */
  dataIndex: number

  /** 当前业务行在排序和筛选后的视图位置。 */
  displayIndex: number

  /** 当前单元格对应的业务列配置。 */
  column: DataGridColumn<Row>

  /** 当前复杂控件对应的编辑器配置。 */
  editor: DataGridEditorConfig<Row>

  /** 打开浮层时用于初始化本地草稿的值。 */
  value: unknown

  /** 用户确认浮层草稿时写入 DataGrid 事务链；返回 false 时保留浮层。 */
  confirm: (value: unknown) => boolean
}

/** DataGrid 共享浮层编辑器向表格宿主公开的方法。 */
export interface DataGridPopupEditorExpose {
  /** 使用指定单元格上下文打开并定位共享浮层。 */
  open<Row extends DataGridRow>(context: DataGridPopupEditorContext<Row>): void

  /** 关闭浮层并丢弃尚未确认的本地草稿。 */
  close(): void
}
