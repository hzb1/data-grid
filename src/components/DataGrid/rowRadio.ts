import type { ICellRendererParams } from 'ag-grid-community'
import type { DataGridRow } from './types'

/** DataGrid 单选行控件属性。 */
export interface DataGridRowRadioProps<Row extends DataGridRow = DataGridRow> {
  /** AG Grid 当前单元格渲染参数。 */
  params: ICellRendererParams<Row>
}
