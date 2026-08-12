/**
 * 组合函数名称：DataGrid 序号列
 * 使用场景：用于生成只读系统序号列，并根据当前展示顺序和分页参数计算连续序号。
 */

import type { ColDef, GridApi } from 'ag-grid-community'
import type { DataGridDiagnosticInput } from '../diagnostics'
import type { DataGridRow, DataGridRowIndexPagination } from '../types'

/** DataGrid 内部序号列标识。 */
export const DATA_GRID_ROW_INDEX_COLUMN_ID = '__dataGridRowIndex'

/** DataGrid 序号列组合函数参数。 */
interface UseDataGridRowIndexOptions<Row extends DataGridRow> {
  /** 获取当前 AG Grid API。 */
  getApi: () => GridApi<Row> | undefined

  /** 获取当前序号列配置。 */
  getConfig: () => boolean | DataGridRowIndexPagination

  /** 报告序号列配置中发现的开发诊断。 */
  reportDiagnostic: (diagnostic: DataGridDiagnosticInput) => void
}

/** 判断分页序号配置是否包含合法正整数。 */
function isValidPagination(config: DataGridRowIndexPagination) {
  return (
    Number.isInteger(config.current) &&
    config.current > 0 &&
    Number.isInteger(config.size) &&
    config.size > 0
  )
}

/** 管理 DataGrid 的系统序号列。 */
export function useDataGridRowIndex<Row extends DataGridRow>(
  options: UseDataGridRowIndexOptions<Row>,
) {
  function resolveStartIndex() {
    const config = options.getConfig()
    if (typeof config === 'boolean') {
      return 1
    }
    if (isValidPagination(config)) {
      return (config.current - 1) * config.size + 1
    }
    options.reportDiagnostic({
      code: 'DG-FEATURE-007',
      level: 'warning',
      message: 'rowNumbering 分页参数 current 和 size 不是正整数，已回退为从 1 开始。',
      suggestion: '为 rowNumbering.current 和 rowNumbering.size 提供大于 0 的整数。',
      dedupeKey: JSON.stringify(config),
      context: { current: config.current, size: config.size },
    })
    return 1
  }

  function createColumnDef(): ColDef<Row> | undefined {
    if (options.getConfig() === false) {
      return
    }
    return {
      colId: DATA_GRID_ROW_INDEX_COLUMN_ID,
      headerName: '#',
      width: 70,
      minWidth: 70,
      maxWidth: 70,
      pinned: 'left',
      lockPinned: true,
      lockPosition: 'left',
      editable: false,
      resizable: false,
      sortable: false,
      filter: false,
      suppressHeaderMenuButton: true,
      suppressMovable: true,
      suppressNavigable: true,
      cellClass: 'data-grid__row-index-cell',
      headerClass: 'data-grid__row-index-header',
      valueGetter: (params) => {
        const displayIndex = params.node?.rowIndex
        if (params.node?.rowPinned || displayIndex === null || displayIndex === undefined) {
          return ''
        }
        return resolveStartIndex() + displayIndex
      },
    }
  }

  function refresh() {
    const config = options.getConfig()
    if (config === false) {
      return
    }
    const api = options.getApi()
    if (!api) {
      return
    }
    // 行号只依赖 AG Grid 最新的 rowIndex，数据更新完成后定向刷新序号列即可；
    // 禁止 redrawRows 全量重建可见行，避免普通字段编辑导致整表闪烁。
    api.refreshCells({
      columns: [DATA_GRID_ROW_INDEX_COLUMN_ID],
      force: true,
    })
  }

  return {
    createColumnDef,
    refresh,
  }
}
