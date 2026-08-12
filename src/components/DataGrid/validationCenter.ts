import type { DataGridRow, DataGridValidationError } from './types'

/**
 * 校验错误在当前表格视图中的可定位状态。
 *
 * - `visible`：错误单元格当前可见并可直接定位。
 * - `filtered`：错误行被当前筛选条件隐藏。
 * - `hidden-column`：错误列当前处于隐藏状态。
 */
export type DataGridValidationItemStatus = 'visible' | 'filtered' | 'hidden-column'

/** DataGrid 校验中心展示和定位的单个错误项。 */
export interface DataGridValidationCenterItem<Row extends DataGridRow = DataGridRow> {
  /** 当前错误在校验中心中的稳定标识。 */
  key: string

  /** 当前完整校验错误。 */
  error: DataGridValidationError<Row>

  /** 当前错误相对于筛选和列显隐状态的定位结果。 */
  status: DataGridValidationItemStatus

  /** 当前错误行经过筛选和排序后的视图位置。 */
  displayIndex: number

  /** 当前表格是否允许打开列配置。 */
  columnSettingEnabled: boolean
}

/** DataGrid 校验中心组件属性。 */
export interface DataGridValidationCenterProps<Row extends DataGridRow = DataGridRow> {
  /** 当前是否仍有异步校验正在执行。 */
  validating: boolean

  /** 按稳定顺序整理后的完整错误项。 */
  items: DataGridValidationCenterItem<Row>[]

  /** 当前前后导航指向的错误标识。 */
  currentErrorKey?: string
}
