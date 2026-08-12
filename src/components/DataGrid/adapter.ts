import type {
  CellClassParams,
  ColDef,
  ColSpanParams,
  EditableCallbackParams,
  ICellRendererParams,
  ITooltipParams,
  RowSpanParams,
  ValueFormatterParams,
} from 'ag-grid-community'
import CellRenderer from './CellRenderer.vue'
import { isDataGridRequiredColumn } from './columnSetting'
import CustomEditor from './CustomEditor.vue'
import type { DataGridMergeRange } from './merge'
import DataGridEditor from './DataGridEditor.vue'
import DataGridFilter from './DataGridFilter.vue'
import DataGridPersistentEditor from './DataGridPersistentEditor.vue'
import { formatOptionValue, getColumnOptions, isColumnOptionsLoading } from './options'
import type { DataGridPopupEditorContext } from './popupEditor'
import type {
  DataGridCellLoadingRenderState,
  DataGridColumn,
  DataGridEditorDisplayMode,
  DataGridMode,
  DataGridRow,
  DataGridRowKey,
  DataGridSlots,
  DataGridVerticalAlign,
} from './types'

/** DataGrid 单元格在当前矩形选区中的边缘状态。 */
type CellSelectionState = {
  /** 当前单元格是否位于选区顶部边缘。 */
  top: boolean

  /** 当前单元格是否位于选区右侧边缘。 */
  right: boolean

  /** 当前单元格是否位于选区底部边缘。 */
  bottom: boolean

  /** 当前单元格是否位于选区左侧边缘。 */
  left: boolean
}

type CreateColumnDefsOptions<Row extends DataGridRow> = {
  /** DataGrid 业务列配置。 */
  columns: DataGridColumn<Row>[]

  /** 表格当前交互模式。 */
  mode: DataGridMode

  /** 表格全部编辑控件采用的统一展示方式。 */
  editorDisplayMode?: DataGridEditorDisplayMode

  /** 表格业务数据列默认使用的垂直对齐方式。 */
  rowVerticalAlign?: DataGridVerticalAlign

  /** 表格是否整体禁用。 */
  disabled: boolean

  /** 表格加载期间禁止打开表头筛选入口。 */
  loading: boolean

  /** DataGrid 当前可用插槽。 */
  slots: DataGridSlots<Row>

  /** 返回业务行在原始受控数组中的位置。 */
  getDataIndex: (row: Row) => number

  /** 返回单元格在当前矩形选区中的边缘状态，未选中时返回空值。 */
  getCellSelectionState?: (displayIndex: number, field: string) => CellSelectionState | undefined

  /** 判断当前单元格是否存在校验错误。 */
  isCellError?: (row: Row, displayIndex: number, field: string) => boolean

  /** 返回当前单元格的校验错误提示。 */
  getCellErrorMessage?: (row: Row, displayIndex: number, field: string) => string | undefined

  /** 返回当前单元格已经进入可见阶段的 Loading 展示状态。 */
  getCellLoadingState?: (
    row: Row,
    displayIndex: number,
    field: string,
  ) => DataGridCellLoadingRenderState | undefined
  /** 判断当前单元格是否被未完成任务阻止修改。 */
  isCellInteractionBlocked?: (row: Row, displayIndex: number, field: string) => boolean
  /** 返回当前单元格纵向覆盖的展示行数。 */
  getRowSpan?: (displayIndex: number, field: string) => number
  /** 返回当前单元格横向覆盖的展示列数。 */
  getColumnSpan?: (displayIndex: number, field: string) => number
  /** 返回当前逻辑单元格所属的完整合并区域。 */
  getCellMergeRange?: (displayIndex: number, field: string) => DataGridMergeRange | undefined
  /** 判断当前逻辑单元格是否属于实际生效的合并区域。 */
  isCellMerged?: (displayIndex: number, field: string) => boolean

  /** 返回当前常显编辑单元格的草稿或业务原值。 */
  getPersistentDraftValue?: (row: Row, field: string, sourceValue: unknown) => unknown

  /** 保存当前常显编辑单元格的最新草稿。 */
  updatePersistentDraft?: (row: Row, field: string, sourceValue: unknown, value: unknown) => void

  /** 提交当前常显编辑单元格的草稿，并返回事务是否接受当前值。 */
  commitPersistentDraft?: (rowKey: DataGridRowKey, field: string) => boolean

  /** 撤销当前常显编辑单元格的草稿。 */
  cancelPersistentDraft?: (rowKey: DataGridRowKey, field: string) => void

  /** 请求 DataGrid 使用共享宿主打开复杂控件浮层。 */
  openPopupEditor?: (context: DataGridPopupEditorContext<Row>) => void

  /** 返回当前业务行的稳定唯一标识。 */
  getRowKey?: (row: Row, dataIndex: number) => DataGridRowKey
}

/** 为 AG Grid 单元格追加可直接用于自定义样式的合并状态类。 */
function appendCellMergeClasses(
  classes: string[],
  range: DataGridMergeRange,
  displayIndex: number,
  field: string,
) {
  const isAnchor = range.start.displayIndex === displayIndex && range.start.columnId === field
  const isEnd = range.end.displayIndex === displayIndex && range.end.columnId === field

  classes.push('data-grid__merged-cell')
  classes.push(range.kind === 'row' ? 'data-grid__row-merge-cell' : 'data-grid__column-merge-cell')
  classes.push(isAnchor ? 'is-merge-anchor' : 'is-merge-covered')
  if (isAnchor) {
    classes.push('is-merge-start')
  }
  if (isEnd) {
    classes.push('is-merge-end')
  }
}

export function isDataGridCellEditable<Row extends DataGridRow>(
  column: DataGridColumn<Row>,
  row: Row,
  mode: DataGridMode,
  disabled: boolean,
  dataIndex = -1,
  displayIndex = -1,
) {
  const editor = column.editor || undefined
  if (!editor || mode !== 'edit' || disabled || isColumnOptionsLoading(column)) {
    return false
  }
  if (column.rowMerge || column.columnMerge) {
    return false
  }
  return typeof editor.editable === 'function'
    ? editor.editable({
        row,
        dataIndex,
        displayIndex,
        field: column.field,
        value: row[column.field],
      })
    : editor.editable !== false
}

/** 判断行业务数据变化前后是否有编辑列切换了动态可编辑状态。 */
export function hasDataGridRowEditableStateChanged<Row extends DataGridRow>(
  columns: DataGridColumn<Row>[],
  previousRow: Row,
  row: Row,
  mode: DataGridMode,
  disabled: boolean,
  dataIndex: number,
  displayIndex: number,
) {
  return columns.some(
    (column) =>
      isDataGridCellEditable(column, previousRow, mode, disabled, dataIndex, displayIndex) !==
      isDataGridCellEditable(column, row, mode, disabled, dataIndex, displayIndex),
  )
}

function createEditor<Row extends DataGridRow>(
  column: DataGridColumn<Row>,
  getDataIndex: (row: Row) => number,
  usePersistentEditor: boolean,
) {
  const editor = column.editor || undefined
  if (!editor || usePersistentEditor) {
    return {}
  }
  return {
    cellDataType: editor.type === 'number' ? 'number' : undefined,
    cellEditor: editor.type === 'custom' ? CustomEditor : DataGridEditor,
    cellEditorParams: {
      dataGridEditor: editor,
      dataGridColumn: column,
      getDataIndex,
    },
  }
}

function createFilter<Row extends DataGridRow>(column: DataGridColumn<Row>, loading: boolean) {
  if (!column.searchType || column.filter === false) {
    return {
      filter: false,
      floatingFilter: false,
    }
  }
  return {
    filter: DataGridFilter,
    filterParams: { dataGridColumn: column },
    suppressHeaderFilterButton: loading,
    suppressHeaderMenuButton: loading,
    floatingFilter: false,
  }
}

export function createDataGridColumnDefs<Row extends DataGridRow>({
  columns,
  mode,
  editorDisplayMode = 'always',
  rowVerticalAlign = 'center',
  disabled,
  loading,
  slots,
  getDataIndex,
  getCellSelectionState,
  isCellError,
  getCellErrorMessage,
  getCellLoadingState,
  isCellInteractionBlocked,
  getRowSpan,
  getColumnSpan,
  getCellMergeRange,
  isCellMerged,
  getPersistentDraftValue,
  updatePersistentDraft,
  commitPersistentDraft,
  cancelPersistentDraft,
  openPopupEditor,
  getRowKey,
}: CreateColumnDefsOptions<Row>): ColDef<Row>[] {
  return columns.map((column) => {
    const slotName = `cell-${String(column.field)}` as keyof DataGridSlots<Row>
    const slot = slots[slotName]
    const persistentEditor = editorDisplayMode === 'always' && !slot ? column.editor : undefined
    const required = isDataGridRequiredColumn(column)
    const align = column.align ?? 'center'
    const headerAlign = column.headerAlign ?? align
    const verticalAlign = column.verticalAlign ?? rowVerticalAlign
    const cellAlignClass = `data-grid__cell--align-${align}`
    const cellVerticalAlignClass = `data-grid__cell--vertical-${verticalAlign}`
    const headerClasses: string[] = [`data-grid__header--align-${headerAlign}`]
    if (required) {
      headerClasses.push('data-grid__required-header')
    }
    // 暂停在表头展示编辑标识，后续需要恢复时重新启用该状态类。
    // if (mode === 'edit' && !disabled && column.editor && column.editor.editable !== false && !column.rowMerge && !column.columnMerge) {
    // 	headerClasses.push('data-grid__editable-header')
    // }
    function resolveCellEditable(row: Row, displayIndex: number) {
      const dataIndex = getDataIndex(row)
      return (
        !isCellMerged?.(displayIndex, column.field) &&
        !isCellInteractionBlocked?.(row, displayIndex, column.field) &&
        isDataGridCellEditable(column, row, mode, disabled || loading, dataIndex, displayIndex)
      )
    }
    function resolveReadonlyReason(row: Row, displayIndex: number) {
      if (mode !== 'edit' || !column.editor || resolveCellEditable(row, displayIndex)) {
        return undefined
      }
      if (disabled) {
        return '表格当前已禁用'
      }
      if (loading) {
        return '表格加载中，暂不可编辑'
      }
      if (isCellMerged?.(displayIndex, column.field)) {
        return '合并单元格不可编辑'
      }
      if (isCellInteractionBlocked?.(row, displayIndex, column.field)) {
        return '当前单元格正在处理，暂不可编辑'
      }
      if (isColumnOptionsLoading(column)) {
        return '选项加载中，暂不可编辑'
      }
      const context = {
        row,
        dataIndex: getDataIndex(row),
        displayIndex,
        field: column.field,
        value: row[column.field],
      }
      const reason = column.editor.readonlyReason
      return (typeof reason === 'function' ? reason(context) : reason) ?? '当前单元格不可编辑'
    }
    function formatCellValue(value: unknown, row: Row, displayIndex: number) {
      if (column.options && isColumnOptionsLoading(column)) {
        return String(value ?? '')
      }
      if (column.formatter) {
        return column.formatter(value, row, displayIndex)
      }
      if (column.editor && column.editor.type === 'boolean') {
        return value === null || value === undefined || value === '' ? '' : value ? '是' : '否'
      }
      if (column.editor && column.editor.type === 'multiSelect' && Array.isArray(value)) {
        const options = getColumnOptions(column)
        return value.map((item) => formatOptionValue(options, item) ?? String(item)).join('、')
      }
      return formatOptionValue(getColumnOptions(column), value) ?? String(value ?? '')
    }
    function resolveTooltip(
      row: Row,
      displayIndex: number,
      value: unknown,
      loadingText?: string,
      errorMessage?: string,
      suppressContentTooltip = false,
    ) {
      if (loadingText || errorMessage) {
        return {
          text: loadingText ?? errorMessage,
          mode: 'always' as const,
          suppressWhileEditing: false,
        }
      }
      const readonlyReason = resolveReadonlyReason(row, displayIndex)
      if (readonlyReason) {
        return { text: readonlyReason, mode: 'always' as const, suppressWhileEditing: false }
      }
      if (suppressContentTooltip) {
        return { text: undefined, mode: 'overflow' as const, suppressWhileEditing: true }
      }
      const formattedValue = formatCellValue(value, row, displayIndex)
      const context = {
        row,
        dataIndex: getDataIndex(row),
        displayIndex,
        field: column.field,
        value,
        formattedValue,
      }
      const businessTooltip = column.tooltipGetter?.(context)
      if (businessTooltip) {
        return { text: businessTooltip, mode: 'always' as const, suppressWhileEditing: true }
      }
      const tooltipMode = column.tooltip === true ? 'always' : (column.tooltip ?? 'overflow')
      if (!formattedValue || !tooltipMode) {
        return { text: undefined, mode: 'overflow' as const, suppressWhileEditing: true }
      }
      return { text: formattedValue, mode: tooltipMode, suppressWhileEditing: true }
    }
    return {
      field: column.field,
      headerName: column.title,
      headerClass: headerClasses.length > 1 ? headerClasses : headerClasses[0],
      cellDataType:
        column.searchType === 'date'
          ? 'dateString'
          : column.editor && column.editor.type === 'boolean'
            ? false
            : undefined,
      width: column.width,
      minWidth: column.minWidth,
      maxWidth: column.maxWidth,
      flex: column.flex,
      pinned: column.fixed,
      hide: required ? false : column.initialVisible === false,
      lockVisible: required || column.configurable === false || column.hideable === false,
      lockPinned: column.configurable === false,
      lockPosition: column.configurable === false,
      suppressMovable: column.configurable === false,
      sortable: column.sortable !== false,
      ...createFilter(column, loading),
      ...createEditor(column, getDataIndex, Boolean(persistentEditor)),
      ...(column.rowMerge
        ? {
            rowSpan(params: RowSpanParams<Row>) {
              const displayIndex = params.node?.rowIndex
              if (params.node?.rowPinned || displayIndex === null || displayIndex === undefined) {
                return 1
              }
              return getRowSpan?.(displayIndex, column.field) ?? 1
            },
          }
        : null),
      ...(column.columnMerge
        ? {
            colSpan(params: ColSpanParams<Row>) {
              const displayIndex = params.node?.rowIndex
              if (params.node?.rowPinned || displayIndex === null || displayIndex === undefined) {
                return 1
              }
              return getColumnSpan?.(displayIndex, column.field) ?? 1
            },
          }
        : null),
      editable(params: EditableCallbackParams<Row>) {
        if (params.node?.rowPinned || !params.data) {
          return false
        }
        return !persistentEditor && resolveCellEditable(params.data, params.node.rowIndex ?? -1)
      },
      cellClass(params: CellClassParams<Row>) {
        if (params.node?.rowPinned) {
          return [
            cellAlignClass,
            'data-grid__summary-cell',
            column.summary && column.summary.className,
          ].filter(Boolean)
        }
        const classes: string[] = [cellAlignClass, cellVerticalAlignClass]
        const customClass =
          typeof column.className === 'function'
            ? column.className(params.data as Row)
            : column.className
        if (customClass) {
          classes.push(customClass)
        }
        const selectionState =
          params.node.rowIndex !== null
            ? getCellSelectionState?.(params.node.rowIndex, column.field)
            : undefined
        if (selectionState) {
          classes.push('data-grid__selected-cell')
          if (selectionState.top) classes.push('is-selection-top')
          if (selectionState.right) classes.push('is-selection-right')
          if (selectionState.bottom) classes.push('is-selection-bottom')
          if (selectionState.left) classes.push('is-selection-left')
        }
        const loadingState =
          params.data && params.node.rowIndex !== null
            ? getCellLoadingState?.(params.data, params.node.rowIndex, column.field)
            : undefined
        const editable =
          params.data && params.node.rowIndex !== null
            ? resolveCellEditable(params.data, params.node.rowIndex)
            : false
        if (editable) {
          classes.push('data-grid__editable-cell')
          if (persistentEditor) {
            classes.push('data-grid__persistent-editor-cell')
          }
        } else if (
          params.data &&
          params.node.rowIndex !== null &&
          mode === 'edit' &&
          column.editor
        ) {
          classes.push('data-grid__readonly-cell')
          if (disabled) {
            classes.push('data-grid__disabled-cell')
          }
        }
        if (loadingState) {
          classes.push('data-grid__loading-cell')
          classes.push(`data-grid__loading-cell--${loadingState.type}`)
        }
        if (
          !loadingState &&
          params.data &&
          params.node.rowIndex !== null &&
          isCellError?.(params.data, params.node.rowIndex, column.field)
        ) {
          classes.push('data-grid__error-cell')
        }
        if (params.node.rowIndex !== null) {
          const mergeRange = getCellMergeRange?.(params.node.rowIndex, column.field)
          if (mergeRange) {
            appendCellMergeClasses(classes, mergeRange, params.node.rowIndex, column.field)
          }
        }
        return classes
      },
      tooltipValueGetter(params: ITooltipParams<Row>) {
        if (!params.data || params.node?.rowPinned) {
          return undefined
        }
        const displayIndex = params.node?.rowIndex ?? -1
        const loadingState = getCellLoadingState?.(params.data, displayIndex, column.field)
        return resolveTooltip(
          params.data,
          displayIndex,
          params.value,
          loadingState?.text,
          getCellErrorMessage?.(params.data, displayIndex, column.field),
          Boolean(persistentEditor && resolveCellEditable(params.data, displayIndex)),
        ).text
      },
      valueFormatter(params: ValueFormatterParams<Row>) {
        if (params.node?.rowPinned) {
          return String(params.value ?? '')
        }
        return formatCellValue(params.value, params.data as Row, params.node?.rowIndex ?? -1)
      },
      cellRendererSelector(params: ICellRendererParams<Row>) {
        const displayIndex = params.node.rowIndex ?? -1
        const loadingState =
          params.data && !params.node.rowPinned
            ? getCellLoadingState?.(params.data, displayIndex, column.field)
            : undefined
        const errorMessage =
          params.data && !params.node.rowPinned && !loadingState
            ? getCellErrorMessage?.(params.data, displayIndex, column.field)
            : undefined
        const tooltip = params.data
          ? resolveTooltip(
              params.data,
              displayIndex,
              params.value,
              loadingState?.text,
              errorMessage,
            )
          : { text: undefined, mode: 'overflow' as const, suppressWhileEditing: true }
        if (
          !params.node.rowPinned &&
          !slot &&
          persistentEditor &&
          params.data &&
          resolveCellEditable(params.data, displayIndex) &&
          getRowKey
        ) {
          const row = params.data
          const dataIndex = getDataIndex(row)
          return {
            component: DataGridPersistentEditor,
            params: {
              dataGridDataIndex: dataIndex,
              dataGridRowKey: getRowKey(row, dataIndex),
              dataGridColumn: column,
              dataGridEditor: persistentEditor,
              dataGridGetDraftValue: (
                _rowKey: DataGridRowKey,
                field: string,
                sourceValue: unknown,
              ) => getPersistentDraftValue?.(row, field, sourceValue) ?? sourceValue,
              dataGridUpdateDraft: (
                _rowKey: DataGridRowKey,
                field: string,
                sourceValue: unknown,
                value: unknown,
              ) => updatePersistentDraft?.(row, field, sourceValue, value),
              dataGridCommitDraft: commitPersistentDraft,
              dataGridCancelDraft: cancelPersistentDraft,
              dataGridOpenPopupEditor: openPopupEditor,
            },
          }
        }
        /*
         * 普通内容使用 AG Grid 原生截断检测；业务提示和自定义插槽通过通用渲染器注册实时 Tooltip，
         * 避免 AG Grid 在单元格创建时缓存 tooltipValueGetter 后无法感知内部节点尺寸。
         */
        return {
          component: CellRenderer,
          params: {
            dataGridSlot: slot,
            dataGridColumn: column,
            dataIndex: params.data ? getDataIndex(params.data) : -1,
            displayIndex,
            dataGridErrorMessage: errorMessage,
            dataGridLoading: loadingState,
            dataGridTooltipText: tooltip.text,
            dataGridTooltipMode: tooltip.mode,
            dataGridTooltipSuppressWhileEditing: tooltip.suppressWhileEditing,
            displayValue: params.node.rowPinned
              ? params.value
              : params.data
                ? formatCellValue(params.value, params.data, displayIndex)
                : params.value,
          },
        }
      },
    } as unknown as ColDef<Row>
  })
}
