<script setup lang="ts" generic="Row extends DataGridRow = DataGridRow">
/**
 * 组件名称：DataGrid 高性能表格
 * 使用场景：用于大数据量查看、编辑、筛选、复制粘贴及用户级列配置。
 */

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import { CloseBold, FullScreen, Setting } from '@element-plus/icons-vue'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import type {
  CellClassParams,
  CellContextMenuEvent,
  CellEditRequestEvent,
  Column,
  ColumnEventType,
  ColumnMovedEvent,
  ColumnPinnedEvent,
  ColumnResizedEvent,
  ColumnVisibleEvent,
  FilterChangedEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ICellRendererParams,
  PostProcessPopupParams,
  RowHeightParams,
  SelectionColumnDef,
  SortChangedEvent,
} from 'ag-grid-community'
import { AgGridVue } from 'ag-grid-vue3'
import { useZIndex } from 'element-plus'
import isEqual from 'lodash/isEqual.js'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue'
import {
  createDataGridColumnDefs,
  hasDataGridRowEditableStateChanged,
  isDataGridCellEditable,
} from './adapter'
import CellRenderer from './CellRenderer.vue'
import {
  claimDataGridClipboardOwner,
  isActiveDataGridClipboardOwner,
  releaseDataGridClipboardOwner,
  serializeClipboardMatrix,
} from './clipboard'
import ColumnSettingDialog from './ColumnSettingDialog.vue'
import { isDataGridColumnSummaryEnabledByDefault } from './columnSetting'
import { collectDataGridRowDiagnostics, collectDataGridStaticDiagnostics } from './diagnosticRules'
import { createDataGridDiagnostics } from './diagnostics'
import DataGridContextMenu from './DataGridContextMenu.vue'
import DataGridFormContextBoundary from './DataGridFormContextBoundary.vue'
import { useDataGridHistory, type DataGridHistoryEntry } from './hooks/useDataGridHistory'
import { useDataGridHeightResize } from './hooks/useDataGridHeightResize'
import { useDataGridFullscreen } from './hooks/useDataGridFullscreen'
import {
  useDataGridPersistentEdit,
  type DataGridPersistentDraft,
} from './hooks/useDataGridPersistentEdit'
import { useDataGridCellLoading } from './hooks/useDataGridCellLoading'
import { useDataGridPaste } from './hooks/useDataGridPaste'
import { useDataGridColumnSetting } from './hooks/useDataGridColumnSetting'
import { DATA_GRID_ROW_DRAG_COLUMN_ID, useDataGridRowDrag } from './hooks/useDataGridRowDrag'
import { DATA_GRID_ROW_INDEX_COLUMN_ID, useDataGridRowIndex } from './hooks/useDataGridRowIndex'
import {
  DATA_GRID_ROW_RADIO_COLUMN_ID,
  useDataGridRowSelection,
} from './hooks/useDataGridRowSelection'
import { useDataGridSelection } from './hooks/useDataGridSelection'
import {
  useDataGridValidation,
  type DataGridValidateRowRequest,
} from './hooks/useDataGridValidation'
import { DATA_GRID_ZH_CN_LOCALE } from './locale'
import { createDataGridMergeResolver, type DataGridMergePoint } from './merge'
import {
  formatOptionValue,
  getColumnOptions,
  isColumnOptionsLoading,
  resolveReactiveValue,
} from './options'
import type { DataGridPopupEditorContext, DataGridPopupEditorExpose } from './popupEditor'
import RowCopyDialog from './RowCopyDialog.vue'
import {
  createDataGridRowIdentity,
  encodeDataGridRowKey,
  isDataGridRowKey,
  resolveDataGridBusinessRowKey,
} from './rowKey'
import DataGridPopupEditorHost from './DataGridPopupEditorHost.vue'
import DataGridValidationCenter from './DataGridValidationCenter.vue'
import { useDataGridRuntimeConfig } from './runtimeConfig'
import {
  applyDataGridRowTransaction,
  createDataGridCandidateRow,
  type DataGridPendingChange,
} from './transaction'
import type { DataGridValidationCenterItem } from './validationCenter'
import type {
  DataGridCellChange,
  DataGridClipboardConfig,
  DataGridClipboardCopyPayload,
  DataGridCopySelectionOptions,
  DataGridClipboardError,
  DataGridClipboardPastePayload,
  DataGridColumn,
  DataGridColumnSettingChange,
  DataGridDataChange,
  DataGridDiagnostic,
  DataGridExpose,
  DataGridField,
  DataGridFilterItem,
  DataGridFullscreenChange,
  DataGridGridReadyPayload,
  DataGridHeightResizeConfig,
  DataGridHistoryConfig,
  DataGridHistoryState,
  DataGridProps,
  DataGridRow,
  DataGridRowDragConfig,
  DataGridRowOrderChange,
  DataGridRowKey,
  DataGridRowSelectionChange,
  DataGridRowCopyChange,
  DataGridRowCopyConfig,
  DataGridRowCopyMode,
  DataGridSelectionRange,
  DataGridSortItem,
  DataGridSlots,
  DataGridToolbarSlotProps,
  DataGridValidateOptions,
  DataGridValidateTrigger,
  DataGridValidationError,
  DataGridValidationResult,
  DataGridValidationState,
  DataGridValueChange,
} from './types'
import {
  cloneDataGridRow,
  convertFilterModel,
  createSummaryRow,
  getFieldValue,
  normalizeEditorValue,
  setFieldValue,
} from './utils'

/** 注册 DataGrid 依赖的 AG Grid Community 功能，宿主无需重复完成基础模块配置。 */
ModuleRegistry.registerModules([AllCommunityModule])
const dataGridMessage = useDataGridRuntimeConfig().messageAdapter

/** DataGrid 内部生成的单次复制内容。 */
interface DataGridClipboardContent {
  /** 写入系统剪贴板的 TSV 文本。 */
  text: string

  /** 本次复制实际覆盖的显示区域。 */
  range?: DataGridSelectionRange

  /** 本次复制的数据行数，不包含表头。 */
  rowCount: number

  /** 本次复制的可见业务列数。 */
  columnCount: number
}

/** DataGrid 当前一次表头列宽拖拽会话。 */
interface DataGridColumnResizeSession {
  /** 当前拖拽指针标识，用于忽略其他指针事件。 */
  pointerId: number

  /** 当前调整的 AG Grid 列。 */
  column: Column

  /** 指针按下时的横向坐标。 */
  startX: number

  /** 指针按下时的列宽。 */
  startWidth: number

  /** 当前列是否固定在右侧，右固定列需反向计算拖拽距离。 */
  pinnedRight: boolean

  /** 接收 pointer capture 的列宽手柄。 */
  handle: HTMLElement
}

/** 汇总说明在当前系统列组合中的优先展示位置。 */
type DataGridSummaryLabelTarget = 'selection' | 'rowDrag' | 'rowIndex' | 'business'

/** DataGrid 拖拽调整高度的默认最大值，单位为 px。 */
const DATA_GRID_DEFAULT_MAX_HEIGHT = 1200

/** DataGrid 数据正文区域的默认最小高度，保证空状态和少量数据仍有清晰的展示空间。 */
const DATA_GRID_DEFAULT_MIN_BODY_HEIGHT = 120

/** DataGrid 工具栏包含上下内边距后的默认占用高度。 */
const DATA_GRID_TOOLBAR_HEIGHT = 50

/** AG Grid 横向滚动条和边框需要预留的高度，避免数据区产生纵向滚动条。 */
const DATA_GRID_GRID_AUXILIARY_HEIGHT = 18

/** 多行汇总文字的紧凑行高，单位为 px。 */
const DATA_GRID_SUMMARY_LINE_HEIGHT = 22

/** 多行汇总内容上下合计预留的垂直间距，单位为 px。 */
const DATA_GRID_SUMMARY_VERTICAL_PADDING = 8

/** 汇总行中保存说明文字的内部字段，不写入业务数据。 */
const DATA_GRID_SUMMARY_LABEL_FIELD = '__dataGridSummaryLabel'

/** DataGrid 根据调用方业务行推导的公开属性。 */
type Props = DataGridProps<Row>

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  diagnostics: undefined,
  mode: 'view',
  editorDisplayMode: 'always',
  disabled: false,
  loading: false,
  heightResize: true,
  showFullscreenButton: true,
  rowHeight: 44,
  rowVerticalAlign: 'center',
  headerHeight: 44,
  summary: false,
  clipboard: () => ({
    copy: true,
    paste: true,
  }),
  rowNumbering: false,
  rowSelection: false,
  selectedRowKeys: () => [],
  rowRules: () => [],
  validation: undefined,
  history: () => ({}),
  rowDrag: false,
  rowCopy: false,
  columnSetting: false,
  processRowChange: undefined,
})

const emit = defineEmits<{
  /** 表格数据通过编辑、粘贴或历史操作变化时触发。 */
  (event: 'update:modelValue', rows: Row[]): void
  /** 用户通过底部手柄或键盘调整表格高度时触发。 */
  (event: 'update:height', height: number): void
  /** 键盘、API 或其他 DataGrid 实例使全屏状态变化时触发。 */
  (event: 'fullscreen-change', change: DataGridFullscreenChange): void
  /** 单个单元格编辑提交后触发。 */
  (event: 'cell-change', payload: DataGridCellChange<Row>): void
  /** 用户调整筛选条件后触发。 */
  (event: 'filter-change', filters: DataGridFilterItem<Row>[]): void
  /** 用户调整排序条件后触发。 */
  (event: 'sort-change', sorts: DataGridSortItem<Row>[]): void
  /** AG Grid 初始化完成且 DataGrid API 可用时触发。 */
  (event: 'grid-ready', payload: DataGridGridReadyPayload): void
  /** 单元格矩形选区范围变化时触发。 */
  (event: 'cell-selection-change', range?: DataGridSelectionRange): void
  /** 行选择状态变化后同步完整已选行标识时触发。 */
  (event: 'update:selectedRowKeys', keys: DataGridRowKey[]): void
  /** 用户、API、数据或配置使行选择发生变化后触发。 */
  (event: 'row-selection-change', change: DataGridRowSelectionChange<Row>): void
  /** 用户复制 DataGrid 选区后触发。 */
  (event: 'clipboard-copy', payload: DataGridClipboardCopyPayload): void
  /** 用户粘贴文本并完成处理后触发。 */
  (event: 'clipboard-paste', payload: DataGridClipboardPastePayload<Row>): void
  /** 剪贴板内容校验或写入失败时逐项触发。 */
  (event: 'clipboard-error', error: DataGridClipboardError<Row>): void
  /** 表格数据事务提交后触发。 */
  (event: 'data-change', payload: DataGridDataChange<Row>): void
  /** 撤销重做栈状态变化时触发。 */
  (event: 'history-change', state: DataGridHistoryState): void
  /** 用户拖动行并完成顺序更新后触发。 */
  (event: 'row-order-change', change: DataGridRowOrderChange<Row>): void
  /** 用户确认复制行且副本写入受控数组后触发。 */
  (event: 'row-copy', change: DataGridRowCopyChange<Row>): void
  /** 列配置由弹窗、表头操作或恢复默认产生变化时触发。 */
  (event: 'column-setting-change', change: DataGridColumnSettingChange): void
  /** 校验进行状态或错误列表变化后触发。 */
  (event: 'validation-change', state: DataGridValidationState<Row>): void
  /** 开发诊断满足当前输出级别并写入控制台后触发。 */
  (event: 'diagnostic', diagnostic: DataGridDiagnostic): void
}>()

const slots = defineSlots<DataGridSlots<Row>>()
const diagnostics = createDataGridDiagnostics({
  getConfig: () => props.diagnostics,
  onDiagnostic: (diagnostic) => emit('diagnostic', diagnostic),
})
const diagnosticsEnabled = computed(() => diagnostics.isEnabled())
/** 归一化运行时传入的数据，避免异步回填前的非数组值导致表格内部报错。 */
const normalizedRows = computed<Row[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
)
/** 当前 DataGrid 实例独享的私有行身份容器。 */
const rowIdentity = createDataGridRowIdentity<Row>()
/** 当前受控数据经过业务标识校验和临时标识兜底后的有效身份快照。 */
const rowKeySnapshot = computed(() =>
  rowIdentity.createSnapshot(normalizedRows.value, props.rowKey),
)
const containerRef = ref<HTMLElement>()
/** 将 AG Grid 菜单浮层挂到页面根节点，避免被 DataGrid 的滚动视口和固定高度裁剪。 */
const popupParent = typeof document === 'undefined' ? undefined : document.body
/** DataGrid 固定使用的 AG Grid 基础行为配置。 */
const gridOptions: GridOptions<Row> = { tooltipShowMode: 'whenTruncated' }
const { nextZIndex } = useZIndex()
const toolbarRef = ref<HTMLElement>()
const measuredToolbarHeight = ref(DATA_GRID_TOOLBAR_HEIGHT)
const gridApi = shallowRef<GridApi<Row>>()
const pendingEditableStateRowKeys = new Set<DataGridRowKey>()
const pinnedBottomRowData = shallowRef<Row[]>([])
/** 等待父组件通过受控属性确认的最近一次 DataGrid 提交结果。 */
const pendingRows = ref<Row[]>()
const columnSettingSummaryFields = ref<Set<string>>(new Set())
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const clipboardOwner = Symbol('data-grid-clipboard-owner')
const rowCopyDialogRef = ref<InstanceType<typeof RowCopyDialog>>()
const popupEditorRef = ref<DataGridPopupEditorExpose>()
const rowCopySourceKey = ref<DataGridRowKey>()
const validationState = shallowRef<DataGridValidationState<Row>>({
  validating: false,
  valid: true,
  errors: [],
})
const validationViewVersion = ref(0)
const currentValidationErrorKey = ref<string>()
const persistentEdit = useDataGridPersistentEdit()
/** 正在等待父级受控数据回写的常显编辑草稿，避免旧行刷新覆盖刚提交的值。 */
const pendingPersistentDraftCommits = new WeakSet<DataGridPersistentDraft>()
let toolbarResizeObserver: ResizeObserver | undefined

/** 读取工具栏真实占用高度，空布局结果继续使用单行默认值。 */
function measureToolbarHeight(element: HTMLElement) {
  const height = Math.ceil(element.getBoundingClientRect().height)
  measuredToolbarHeight.value =
    Number.isFinite(height) && height > 0 ? height : DATA_GRID_TOOLBAR_HEIGHT
}

watch(
  toolbarRef,
  (element) => {
    toolbarResizeObserver?.disconnect()
    toolbarResizeObserver = undefined
    if (!element) {
      measuredToolbarHeight.value = DATA_GRID_TOOLBAR_HEIGHT
      return
    }
    measureToolbarHeight(element)
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    toolbarResizeObserver = new ResizeObserver(() => measureToolbarHeight(element))
    toolbarResizeObserver.observe(element)
  },
  { flush: 'post' },
)

const isFlexibleHeight = computed(() => props.height === 'flex')
const heightResizeConfig = computed<DataGridHeightResizeConfig | false>(() =>
  props.heightResize === false
    ? false
    : typeof props.heightResize === 'object'
      ? props.heightResize
      : {},
)

/** 根据当前工具栏和表头高度，为数据正文保留稳定的最小展示空间。 */
function getDefaultMinimumHeight() {
  const toolbarHeight = toolbarVisible.value ? measuredToolbarHeight.value : 0
  return (
    toolbarHeight +
    props.headerHeight +
    DATA_GRID_DEFAULT_MIN_BODY_HEIGHT +
    DATA_GRID_GRID_AUXILIARY_HEIGHT
  )
}

const heightResizeEnabled = computed(
  () =>
    Boolean(normalizedRows.value.length) &&
    !isFlexibleHeight.value &&
    Boolean(heightResizeConfig.value),
)
const heightResize = useDataGridHeightResize({
  getElement: () => containerRef.value,
  getExternalHeight: () => props.height,
  isEnabled: () => heightResizeEnabled.value,
  getMinHeight: () =>
    heightResizeConfig.value
      ? (heightResizeConfig.value.min ?? getDefaultMinimumHeight())
      : getDefaultMinimumHeight(),
  getMaxHeight: () =>
    heightResizeConfig.value
      ? (heightResizeConfig.value.max ?? DATA_GRID_DEFAULT_MAX_HEIGHT)
      : DATA_GRID_DEFAULT_MAX_HEIGHT,
  onChange: (height) => emit('update:height', height),
  onExceedMax: (maxHeight) => {
    dataGridMessage.warning(`已达到表格最大高度（${maxHeight}px）`)
  },
})
const clipboardConfig = computed<DataGridClipboardConfig<Row> | false>(() => {
  if (props.clipboard === false) {
    return false
  }
  const config = typeof props.clipboard === 'object' ? props.clipboard : {}
  return {
    copy: true,
    paste: true,
    copyHeaders: false,
    repeatToSelection: true,
    emptyTextAction: 'ignore',
    overflow: 'append',
    ...config,
    errorHandling: {
      cellErrorMode: 'abort',
      rowErrorMode: 'abort',
      ...config.errorHandling,
    },
  }
})
const validationConfig = computed(() => props.validation || {})
const validationEnabled = computed(
  () =>
    props.validation !== false &&
    (props.validation !== undefined ||
      props.columns.some((column) => Boolean(column.rules?.length)) ||
      Boolean(props.rowRules.length)),
)
const historyConfig = computed<DataGridHistoryConfig | false>(() =>
  props.history === false
    ? false
    : {
        limit: 20,
        clearOnSort: true,
        clearOnFilter: true,
        ...(typeof props.history === 'object' ? props.history : {}),
      },
)
const rowDragConfig = computed<DataGridRowDragConfig<Row> | false>(() =>
  props.rowDrag === false
    ? false
    : {
        handleWidth: 44,
        fixed: 'left',
        ...(typeof props.rowDrag === 'object' ? props.rowDrag : {}),
      },
)
const activeRowDragConfig = computed(() =>
  props.mode === 'edit' && !props.disabled ? rowDragConfig.value : false,
)
const rowSelectionConfig = computed(() => props.rowSelection || false)

/** 集中判断当前实例是否实际启用了强依赖稳定行标识的功能。 */
function hasStrongRowKeyDependency() {
  return Boolean(rowSelectionConfig.value && rowSelectionConfig.value.reserveSelection)
}

/** 当前是否实际启用了依赖稳定业务行标识的能力。 */
const requiresStableRowKey = computed(hasStrongRowKeyDependency)
const rowCopyConfig = computed<Required<DataGridRowCopyConfig<Row>> | false>(() => {
  if (!props.rowCopy) {
    return false
  }
  const config = typeof props.rowCopy === 'object' ? props.rowCopy : {}
  const min = Number.isInteger(config.min) ? Math.max(1, config.min as number) : 1
  const max = Math.max(min, Number.isInteger(config.max) ? (config.max as number) : 99)
  const configuredDefaultCount = Number.isInteger(config.defaultCount)
    ? (config.defaultCount as number)
    : 1
  const defaultCount = Math.min(max, Math.max(min, configuredDefaultCount))
  return {
    defaultCount,
    min,
    max,
    defaultMode: config.defaultMode === 'append' ? 'append' : 'insert',
    processInsertedRows: config.processInsertedRows ?? ((rows) => rows),
  }
})
const rowCopyVisible = computed(
  () => Boolean(rowCopyConfig.value) && props.mode === 'edit' && !props.disabled,
)
const rowCopyDisabledReason = computed(() => {
  if (props.disabled) {
    return '表格已禁用，暂不可复制行'
  }
  if (props.loading) {
    return '表格正在加载，暂不可复制行'
  }
  const selectedRowKeys = rowSelectionManager.getSelectedRowKeys()
  if (!selectedRowKeys.length) {
    return '请选择一行数据进行复制'
  }
  if (selectedRowKeys.length > 1) {
    return '复制行仅支持选择一行'
  }
  if (rowSelectionManager.getSelectedRows(selectedRowKeys).length !== 1) {
    return '所选数据不在当前表格中，请重新选择'
  }
  return ''
})
const columnSettingConfig = computed(() => props.columnSetting || false)
const columnSettingEnabled = computed(() => Boolean(columnSettingConfig.value))
const hasRowMerge = computed(() => props.columns.some((column) => Boolean(column.rowMerge)))
const hasCellMerge = computed(() =>
  props.columns.some((column) => Boolean(column.rowMerge || column.columnMerge)),
)
const summaryLabelTarget = computed<DataGridSummaryLabelTarget>(() => {
  const selectionConfig = rowSelectionConfig.value
  const hasSelectionColumn = Boolean(
    selectionConfig &&
    ((selectionConfig.showCheckbox ?? true) ||
      (selectionConfig.mode === 'multiple' && (selectionConfig.headerSelectAll ?? true))),
  )
  if (hasSelectionColumn) {
    return 'selection'
  }
  if (activeRowDragConfig.value && (activeRowDragConfig.value.fixed ?? 'left') === 'left') {
    return 'rowDrag'
  }
  if (props.rowNumbering) {
    return 'rowIndex'
  }
  return 'business'
})
const rowIndex = useDataGridRowIndex<Row>({
  getApi: () => gridApi.value,
  getConfig: () => props.rowNumbering,
  reportDiagnostic: diagnostics.report,
})
const cellMerge = createDataGridMergeResolver<Row>({
  getApi: () => gridApi.value,
  getColumns: () => props.columns,
  getDataIndex: findDataIndex,
})
const selection = useDataGridSelection(
  () => gridApi.value,
  () => Boolean(clipboardConfig.value),
  (range) => {
    if (range) {
      claimDataGridClipboardOwner(clipboardOwner)
    } else {
      releaseDataGridClipboardOwner(clipboardOwner)
    }
    gridApi.value?.refreshCells({ force: true })
    emit('cell-selection-change', range)
  },
  isCellSelectionColumn,
  (point) => cellMerge.getCellMergeRange(point.displayIndex, point.columnId),
)
const historyManager = useDataGridHistory<Row>(
  () => (historyConfig.value ? (historyConfig.value.limit ?? 20) : 20),
  (state) => emit('history-change', state),
)
const rowSelectionManager = useDataGridRowSelection<Row>({
  getApi: () => gridApi.value,
  getRows: () => normalizedRows.value,
  getConfig: () => rowSelectionConfig.value,
  getExternalKeys: () => props.selectedRowKeys,
  getRowKey: (row) => getRowIdentity(row) ?? rowIdentity.getOrCreateInternalKey(row),
  isInternalRowKey: rowIdentity.isInternalKey,
  onChange: (change) => {
    emit('update:selectedRowKeys', change.selectedRowKeys)
    emit('row-selection-change', change)
  },
})
const selectionColumnDef = computed<SelectionColumnDef>(() => ({
  ...rowSelectionManager.selectionColumnDef.value,
  ...(summaryLabelTarget.value === 'selection'
    ? {
        cellRendererSelector: createSummaryLabelRenderer,
        cellStyle: createSummaryLabelCellStyle,
      }
    : {}),
}))
const rowDrag = useDataGridRowDrag<Row>({
  getApi: () => gridApi.value,
  getRows: () => normalizedRows.value,
  getConfig: () => activeRowDragConfig.value,
  getRowIdentity,
  findDataIndex,
  canReorder: () => props.mode === 'edit' && !props.disabled && !props.loading && hasStableRowKey(),
  onCommit: commitRowOrder,
})
const columnSetting = useDataGridColumnSetting<Row>({
  getApi: () => gridApi.value,
  getColumns: () => props.columns,
  getConfig: () => columnSettingConfig.value,
  onChange: (change) => emit('column-setting-change', change),
  reportDiagnostic: diagnostics.report,
  onSummaryChange: (fields) => {
    columnSettingSummaryFields.value = fields
    nextTick(updateSummary)
  },
})

function getSourceRowContext(row: Row) {
  const dataIndex = findDataIndex(row)
  return {
    dataIndex,
    rowKey: getRowIdentity(row),
  }
}

const cellLoading = useDataGridCellLoading({
  onChange: () => gridApi.value?.refreshCells({ force: true }),
})

const validationManager = useDataGridValidation<Row>({
  getColumns: () => props.columns,
  getRowRules: () => props.rowRules,
  isEnabled: () => validationEnabled.value,
  getConcurrency: () => Math.max(1, validationConfig.value.concurrency ?? 6),
  isRowActive: (rowKey) =>
    normalizedRows.value.some((row, index) => Object.is(getRowIdentity(row), rowKey)),
  onChange: (state) => {
    validationState.value = state
    emit('validation-change', state)
  },
  onRefresh: () => gridApi.value?.refreshCells({ force: true }),
  startCellLoading: (rowKey, field) =>
    cellLoading.startCellLoading(rowKey, field, {
      type: 'validation',
      // 编辑校验在后台执行，用户再次修改时需要能够进入编辑器并取消上一轮校验。
      blockInteraction: false,
    }),
})

const pasteManager = useDataGridPaste<Row>({
  getApi: () => gridApi.value,
  getBounds: selection.getBounds,
  getSelectionRange: selection.getRange,
  selectRange: selection.selectRange,
  getConfig: () => clipboardConfig.value,
  getMode: () => props.mode,
  isDisabled: () => props.disabled,
  isLoading: () => props.loading,
  getRows: () => normalizedRows.value,
  getColumns: () => props.columns,
  getValidationConcurrency: () => validationConfig.value.concurrency ?? 6,
  getRowKey: (row) => getRowIdentity(row) ?? rowIdentity.getOrCreateInternalKey(row),
  hasStableRowKey,
  findDataIndex,
  isCellMerged: cellMerge.isCellMerged,
  isCellInteractionBlocked: cellLoading.isCellInteractionBlocked,
  startCellLoading: (rowKey, field) =>
    cellLoading.startCellLoading(rowKey, field, {
      type: 'validation',
      blockInteraction: true,
    }),
  createCandidateRow: (previousRow, changes, dataIndex) =>
    createCandidateRow(previousRow, changes, 'paste', dataIndex),
  commitChanges: (changes, baseRows, appendedRowCount) =>
    commitChanges(changes, 'paste', baseRows, appendedRowCount),
  validationManager,
  reportError: emitClipboardError,
  onClipboardError: (error) => {
    emit('clipboard-error', error)
    dataGridMessage.error(error.message)
  },
  onPasteFeedback: (level, message) => dataGridMessage[level](message),
  onPaste: (payload) => {
    emit('clipboard-paste', payload)
    const appendedText = payload.appendedCount ? `，新增 ${payload.appendedCount} 行` : ''
    const skippedText =
      payload.skippedCellCount || payload.skippedRowCount
        ? `，跳过 ${payload.skippedCellCount} 个单元格、${payload.skippedRowCount} 行`
        : ''
    const message = `已粘贴 ${payload.changedCount} 个单元格${appendedText}${skippedText}`
    if (payload.skippedCount) {
      dataGridMessage.warning(message)
    } else {
      dataGridMessage.success(message)
    }
  },
})
const pasteText = pasteManager.pasteText

function getValidationMergePoints(displayIndex: number, field: string): DataGridMergePoint[] {
  const range = cellMerge.getCellMergeRange(displayIndex, field)
  if (!range || range.start.displayIndex !== displayIndex || range.start.columnId !== field) {
    return [{ displayIndex, columnId: field }]
  }
  return cellMerge.getMergePoints(range)
}

function someMergedValidationCell(
  displayIndex: number,
  field: string,
  predicate: (rowKey: DataGridRowKey, dataIndex: number, field: string) => boolean,
) {
  return getValidationMergePoints(displayIndex, field).some((point) => {
    const row = gridApi.value?.getDisplayedRowAtIndex(point.displayIndex)?.data
    if (!row) {
      return false
    }
    const context = getSourceRowContext(row)
    return predicate(context.rowKey, context.dataIndex, point.columnId)
  })
}

function getMergedValidationMessage(displayIndex: number, field: string) {
  const messages = getValidationMergePoints(displayIndex, field).flatMap((point) => {
    const row = gridApi.value?.getDisplayedRowAtIndex(point.displayIndex)?.data
    if (!row) {
      return []
    }
    const context = getSourceRowContext(row)
    const message = validationManager.getCellErrorMessage(context.rowKey, point.columnId)
    return message ? [message] : []
  })
  return [...new Set(messages)].join('；') || undefined
}

function getMergedCellLoadingState(displayIndex: number, field: string) {
  for (const point of getValidationMergePoints(displayIndex, field)) {
    const row = gridApi.value?.getDisplayedRowAtIndex(point.displayIndex)?.data
    if (!row) {
      continue
    }
    const context = getSourceRowContext(row)
    const state = cellLoading.getCellLoadingState(context.rowKey, point.columnId)
    if (state) {
      return state
    }
  }
}

function isCellInteractionBlocked(row: Row, field: string) {
  const context = getSourceRowContext(row)
  return context.dataIndex >= 0 && cellLoading.isCellInteractionBlocked(context.rowKey, field)
}

function getMergedCellSelectionState(displayIndex: number, field: string) {
  const range = cellMerge.getCellMergeRange(displayIndex, field)
  if (!range || range.start.displayIndex !== displayIndex || range.start.columnId !== field) {
    return selection.getCellSelectionState(displayIndex, field)
  }
  const startState = selection.getCellSelectionState(range.start.displayIndex, range.start.columnId)
  const endState = selection.getCellSelectionState(range.end.displayIndex, range.end.columnId)
  if (!startState && !endState) {
    return
  }
  return {
    top: Boolean(startState?.top || endState?.top),
    right: Boolean(startState?.right || endState?.right),
    bottom: Boolean(startState?.bottom || endState?.bottom),
    left: Boolean(startState?.left || endState?.left),
  }
}

watchEffect(() => {
  diagnostics.sync([
    ...collectDataGridStaticDiagnostics({
      columns: props.columns,
      slotNames: Object.keys(slots),
      mode: props.mode,
      clipboard: clipboardConfig.value,
      validation: props.validation,
      hasRowRules: Boolean(props.rowRules.length),
      history: historyConfig.value,
      rowDrag: rowDragConfig.value,
      rowSelection: rowSelectionConfig.value,
      columnSetting: columnSettingConfig.value,
    }),
    ...collectDataGridRowDiagnostics({
      rows: normalizedRows.value,
      selectedRowKeys: props.selectedRowKeys,
      getRowKey: getRowIdentity,
      rowKeyIssues: rowKeySnapshot.value.issues,
      generatedRowKeyCount: rowKeySnapshot.value.entries.filter((entry) => entry.generated).length,
      hasExplicitRowKey: props.rowKey !== undefined,
      requiresStableRowKey: requiresStableRowKey.value,
    }),
  ])
})
const {
  dialogVisible: columnSettingVisible,
  dialogColumns: columnSettingColumns,
  dialogMinVisibleCount: columnSettingMinVisibleCount,
  initialize: initializeColumnSetting,
  persist: persistColumnSetting,
  schedulePersist: scheduleColumnSettingPersist,
  open: openColumnSetting,
  save: saveColumnSetting,
  reset: resetColumnSetting,
} = columnSetting

function shouldKeepFullscreenOnEscape() {
  return Boolean(
    columnSettingVisible.value ||
    contextMenuVisible.value ||
    gridApi.value?.getEditingCells().length ||
    containerRef.value?.querySelector('.ag-popup'),
  )
}

/** 让 AG Grid 浮层参与 Element Plus 递增层级，确保后打开的日期面板能够覆盖筛选面板。 */
function postProcessGridPopup(params: PostProcessPopupParams<Row>) {
  if (params.ePopup.style.zIndex) {
    return
  }
  params.ePopup.style.zIndex = String(nextZIndex())
}

function refreshFullscreenLayout() {
  gridApi.value?.refreshHeader()
  gridApi.value?.refreshCells({ force: true })
  gridApi.value?.redrawRows()
  rowDrag.refreshHandles()
  updateSummary()
  heightResize.refreshBounds()
}

const fullscreenController = useDataGridFullscreen({
  getElement: () => containerRef.value,
  shouldKeepFullscreenOnEscape,
  onLayoutChange: refreshFullscreenLayout,
  onChange: (fullscreen, source) => emit('fullscreen-change', { fullscreen, source }),
})

function createSummaryLabelRenderer(params: ICellRendererParams<Row>) {
  if (!params.node.rowPinned) {
    return undefined
  }
  return {
    component: CellRenderer,
    params: {
      displayValue: params.data?.[DATA_GRID_SUMMARY_LABEL_FIELD],
    },
  }
}

function createSummaryLabelCellStyle(params: CellClassParams<Row>) {
  return params.node.rowPinned
    ? {
        alignItems: 'center',
        padding: '0',
        overflow: 'visible',
        fontSize: '12px',
        textAlign: 'center',
        zIndex: 2,
      }
    : undefined
}

function createValidationErrorKey(error: DataGridValidationError<Row>) {
  return JSON.stringify([
    typeof error.rowKey,
    error.rowKey,
    error.field,
    error.source,
    error.message,
  ])
}

function getValidationColumnOrder() {
  const gridColumns = gridApi.value?.getColumns()
  return (
    gridColumns?.length
      ? gridColumns.map((column) => column.getColId())
      : props.columns.map((column) => column.field)
  ).filter((field) => props.columns.some((column) => column.field === field))
}

const validationCenterEnabled = computed(
  () => validationEnabled.value && validationConfig.value.center !== false,
)
const validationCenterItems = computed<DataGridValidationCenterItem<Row>[]>(() => {
  void validationViewVersion.value
  const columnOrder = new Map(getValidationColumnOrder().map((field, index) => [field, index]))
  return [...validationState.value.errors]
    .sort(
      (left, right) =>
        left.dataIndex - right.dataIndex ||
        (columnOrder.get(left.field) ?? Number.MAX_SAFE_INTEGER) -
          (columnOrder.get(right.field) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((error) => {
      const displayIndex = findDisplayIndex(error.rowKey)
      const gridColumn = gridApi.value?.getColumn(error.field)
      const columnVisible = gridApi.value
        ? Boolean(gridColumn?.isVisible())
        : props.columns.some(
            (column) => column.field === error.field && column.initialVisible !== false,
          )
      return {
        key: createValidationErrorKey(error),
        error,
        status: !columnVisible ? 'hidden-column' : displayIndex < 0 ? 'filtered' : 'visible',
        displayIndex,
        columnSettingEnabled: columnSettingEnabled.value,
      }
    })
})
const locatableValidationItems = computed(() =>
  validationCenterItems.value.filter((item) => item.status === 'visible'),
)
const validationCenterVisible = computed(
  () =>
    validationCenterEnabled.value &&
    (validationState.value.validating || validationCenterItems.value.length > 0),
)

watch(
  locatableValidationItems,
  (items, previousItems = []) => {
    if (!items.length) {
      currentValidationErrorKey.value = undefined
      return
    }
    if (!items.some((item) => item.key === currentValidationErrorKey.value)) {
      const previousIndex = previousItems.findIndex(
        (item) => item.key === currentValidationErrorKey.value,
      )
      const nextKey = previousItems
        .slice(Math.max(previousIndex + 1, 0))
        .map((item) => item.key)
        .find((key) => items.some((item) => item.key === key))
      currentValidationErrorKey.value =
        nextKey ?? items[Math.min(Math.max(previousIndex, 0), items.length - 1)].key
    }
  },
  { immediate: true },
)

const toolbarVisible = computed(
  () =>
    Boolean(props.showFullscreenButton) ||
    fullscreenController.fullscreen.value ||
    columnSettingEnabled.value ||
    rowCopyVisible.value ||
    validationCenterVisible.value ||
    Boolean(slots['toolbar-left']) ||
    Boolean(slots['toolbar-right']),
)
watch(
  rowKeySnapshot,
  (snapshot, previousSnapshot) => {
    if (!previousSnapshot || props.selectedRowKeys.length === 0) {
      return
    }
    const migratedKeys = props.selectedRowKeys.flatMap<DataGridRowKey>((rowKey) => {
      const previousEntry = previousSnapshot.keyToEntry.get(rowKey)
      if (!previousEntry) {
        return [rowKey]
      }
      if (!previousEntry.generated) {
        return [rowKey]
      }
      const currentEntry = snapshot.rowToEntry.get(previousEntry.row)
      return currentEntry ? [currentEntry.rowKey] : []
    })
    const sameKeys =
      props.selectedRowKeys.length === migratedKeys.length &&
      props.selectedRowKeys.every((key, index) => Object.is(key, migratedKeys[index]))
    if (!sameKeys) {
      emit('update:selectedRowKeys', migratedKeys)
    }
  },
  { flush: 'sync' },
)

const toolbarSlotProps = computed<DataGridToolbarSlotProps>(() => ({
  fullscreen: fullscreenController.fullscreen.value,
  enterFullscreen: fullscreenController.enterFullscreen,
  exitFullscreen: fullscreenController.exitFullscreen,
  toggleFullscreen: fullscreenController.toggleFullscreen,
  openColumnSetting,
}))

/** 当前汇总行需要展示的最大文本行数。 */
const summaryLineCount = computed(() => {
  const summaryRow = pinnedBottomRowData.value[0]
  if (!summaryRow) {
    return 1
  }
  return Math.max(
    1,
    ...Object.values(summaryRow).map((value) => (Array.isArray(value) ? value.length : 1)),
  )
})

/** 当前汇总行按文字行高紧凑计算后的实际高度。 */
const summaryRowHeight = computed(() =>
  Math.max(
    props.rowHeight,
    summaryLineCount.value * DATA_GRID_SUMMARY_LINE_HEIGHT + DATA_GRID_SUMMARY_VERTICAL_PADDING,
  ),
)

/** 多行汇总时按紧凑文字高度扩展固定底部行。 */
function getTableRowHeight(params: RowHeightParams<Row>) {
  return params.node.rowPinned ? summaryRowHeight.value : props.rowHeight
}

/** 未传入固定高度时，完整容纳当前数据行并限制在允许的高度范围内。 */
const automaticHeight = computed(() => {
  const resizeConfig = heightResizeConfig.value || {}
  const minHeight = resizeConfig.min ?? getDefaultMinimumHeight()
  const maxHeight = Math.max(minHeight, resizeConfig.max ?? DATA_GRID_DEFAULT_MAX_HEIGHT)
  const toolbarHeight = toolbarVisible.value ? measuredToolbarHeight.value : 0
  const summaryHeight = pinnedBottomRowData.value.length ? summaryRowHeight.value : 0
  const contentHeight =
    toolbarHeight +
    props.headerHeight +
    props.rowHeight * normalizedRows.value.length +
    summaryHeight +
    DATA_GRID_GRID_AUXILIARY_HEIGHT
  return Math.min(maxHeight, Math.max(minHeight, contentHeight))
})

const containerStyle = computed(() => {
  const resizeConfig = heightResizeConfig.value || {}
  const style: Record<string, string> = {
    '--data-grid-header-height': `${props.headerHeight}px`,
    '--data-grid-min-height': `${resizeConfig.min ?? getDefaultMinimumHeight()}px`,
  }
  if (fullscreenController.fullscreen.value || isFlexibleHeight.value) {
    return style
  }
  style.height =
    heightResize.resizedHeight.value !== undefined
      ? `${heightResize.resizedHeight.value}px`
      : typeof props.height === 'number'
        ? `${props.height}px`
        : props.height || `${automaticHeight.value}px`
  return style
})

const columnDefs = computed(() => {
  const businessColumnDefs = createDataGridColumnDefs({
    columns: props.columns,
    mode: props.mode,
    editorDisplayMode: props.editorDisplayMode,
    rowVerticalAlign: props.rowVerticalAlign,
    disabled: props.disabled,
    loading: props.loading,
    slots,
    getDataIndex: findDataIndex,
    getCellSelectionState: getMergedCellSelectionState,
    isCellError: (_row, displayIndex, field) =>
      someMergedValidationCell(displayIndex, field, (rowKey, _dataIndex, targetField) =>
        validationManager.isCellError(rowKey, targetField),
      ),
    getCellErrorMessage: (_row, displayIndex, field) =>
      getMergedValidationMessage(displayIndex, field),
    getCellLoadingState: (_row, displayIndex, field) =>
      getMergedCellLoadingState(displayIndex, field),
    isCellInteractionBlocked: (row, _displayIndex, field) => isCellInteractionBlocked(row, field),
    getRowSpan: cellMerge.getRowSpan,
    getColumnSpan: cellMerge.getColumnSpan,
    getCellMergeRange: cellMerge.getCellMergeRange,
    isCellMerged: cellMerge.isCellMerged,
    getPersistentDraftValue,
    updatePersistentDraft,
    commitPersistentDraft,
    cancelPersistentDraft,
    openPopupEditor,
    getRowKey: getRowIdentity,
  })
  const rowDragColumn = rowDrag.createColumnDef()
  const rowIndexColumn = rowIndex.createColumnDef()
  const rowRadioColumn = rowSelectionManager.singleSelectionColumnDef.value
  if (rowRadioColumn && summaryLabelTarget.value === 'selection') {
    rowRadioColumn.cellRendererSelector = createSummaryLabelRenderer
    rowRadioColumn.cellStyle = createSummaryLabelCellStyle
  }
  if (rowDragColumn && summaryLabelTarget.value === 'rowDrag') {
    rowDragColumn.cellRendererSelector = createSummaryLabelRenderer
    rowDragColumn.cellStyle = createSummaryLabelCellStyle
  }
  if (rowIndexColumn && summaryLabelTarget.value === 'rowIndex') {
    rowIndexColumn.cellRendererSelector = createSummaryLabelRenderer
    rowIndexColumn.cellStyle = createSummaryLabelCellStyle
  }
  return [
    ...(rowRadioColumn ? [rowRadioColumn] : []),
    ...(rowDragColumn ? [rowDragColumn] : []),
    ...(rowIndexColumn ? [rowIndexColumn] : []),
    ...businessColumnDefs,
  ]
})

const defaultColDef = {
  resizable: true,
  suppressHeaderMenuButton: false,
}

function isCellSelectionColumn(columnId: string) {
  if (
    columnId === DATA_GRID_ROW_RADIO_COLUMN_ID ||
    columnId === DATA_GRID_ROW_DRAG_COLUMN_ID ||
    columnId === DATA_GRID_ROW_INDEX_COLUMN_ID
  ) {
    return false
  }
  return Boolean(getColumn(columnId))
}

function getRowIdentity(row: Row): DataGridRowKey {
  const entry = rowKeySnapshot.value.rowToEntry.get(row)
  if (entry) {
    return entry.rowKey
  }
  const dataIndex = normalizedRows.value.indexOf(row)
  if (dataIndex >= 0) {
    return rowKeySnapshot.value.entries[dataIndex]?.rowKey
  }
  const existingInternalKey = rowIdentity.getInternalKey(row)
  if (existingInternalKey !== undefined) {
    return existingInternalKey
  }
  try {
    const businessKey = resolveDataGridBusinessRowKey(row, props.rowKey)
    if (isDataGridRowKey(businessKey)) {
      return businessKey
    }
  } catch {
    // 业务解析失败时继续返回 undefined
  }
  return rowIdentity.getOrCreateInternalKey(row)
}

function requireRowIdentity(row: Row): DataGridRowKey {
  const rowKey = getRowIdentity(row)
  if (rowKey === undefined) {
    throw new Error('DataGrid: 无法解析行标识，请确保数据已传入且 rowKey 配置正确')
  }
  return rowKey
}

function hasStableRowKey() {
  return rowKeySnapshot.value.tokenToEntry.size === rowKeySnapshot.value.entries.length
}

function getRowId(params: GetRowIdParams<Row>) {
  const rowKey = getRowIdentity(params.data)
  if (rowKey === undefined) {
    throw new Error('DataGrid: getRowId 无法解析行标识')
  }
  return encodeDataGridRowKey(rowKey)
}

function findDataIndex(row: Row) {
  const entry = rowKeySnapshot.value.rowToEntry.get(row)
  if (entry) {
    return entry.dataIndex
  }
  const directIndex = normalizedRows.value.indexOf(row)
  if (directIndex >= 0) {
    return directIndex
  }
  const rowKey = getRowIdentity(row)
  if (rowKey === undefined) {
    return -1
  }
  const keyEntry = rowKeySnapshot.value.keyToEntry.get(rowKey)
  return keyEntry?.dataIndex ?? -1
}

/** 返回常显输入单元格的草稿值；没有草稿时返回当前业务值。 */
function getPersistentDraftValue(row: Row, field: string, sourceValue: unknown) {
  const dataIndex = findDataIndex(row)
  return dataIndex < 0
    ? sourceValue
    : persistentEdit.getValue(requireRowIdentity(row), field, sourceValue)
}

/** 保存常显输入单元格的最新草稿，不直接修改受控业务行。 */
function updatePersistentDraft(row: Row, field: string, sourceValue: unknown, value: unknown) {
  const dataIndex = findDataIndex(row)
  if (dataIndex >= 0) {
    persistentEdit.setValue(requireRowIdentity(row), field, sourceValue, value)
  }
}

/** 返回与稳定行标识匹配的当前业务行。 */
function findRowByKey(rowKey: DataGridRowKey) {
  return rowKeySnapshot.value.keyToEntry.get(rowKey)?.row
}

/** 提交常显输入单元格的草稿，并在父级受控数据回写后删除临时值。 */
function commitPersistentDraft(rowKey: DataGridRowKey, field: string) {
  const draft = persistentEdit.getDraft(rowKey, field)
  const row = draft ? findRowByKey(rowKey) : undefined
  if (!draft || !row) {
    persistentEdit.remove(rowKey, field)
    return !draft
  }
  if (pendingPersistentDraftCommits.has(draft)) {
    return true
  }
  if (commitCellValue(row, field, draft.value)) {
    pendingPersistentDraftCommits.add(draft)
    nextTick(() => {
      if (persistentEdit.getDraft(rowKey, field) === draft) {
        persistentEdit.remove(rowKey, field)
      }
      pendingPersistentDraftCommits.delete(draft)
    })
    return true
  }
  return false
}

/** 撤销常显输入单元格的草稿。 */
function cancelPersistentDraft(rowKey: DataGridRowKey, field: string) {
  persistentEdit.remove(rowKey, field)
}

/** 请求全表唯一浮层宿主打开 textarea 或 multiSelect 编辑器。 */
function openPopupEditor(context: DataGridPopupEditorContext<Row>) {
  popupEditorRef.value?.open(context)
}

/** 关闭复杂控件浮层，并丢弃其中尚未确认的本地草稿。 */
function closePopupEditor() {
  popupEditorRef.value?.close()
}

/** 依次提交全部常显输入草稿，等待父级受控数据完成每次回写后再处理下一项。 */
async function flushPersistentDrafts() {
  for (const draft of persistentEdit.getDrafts()) {
    const row = findRowByKey(draft.rowKey)
    if (!row) {
      persistentEdit.remove(draft.rowKey, draft.field)
      continue
    }
    if (!commitCellValue(row, draft.field, draft.value)) {
      return false
    }
    persistentEdit.remove(draft.rowKey, draft.field)
    await nextTick()
  }
  return true
}

function getDisplayedRows() {
  const rows: Row[] = []
  gridApi.value?.forEachNodeAfterFilterAndSort((node) => {
    if (node.data && !node.rowPinned) {
      rows.push(node.data)
    }
  })
  return rows
}

/** 判断两个汇总字段值是否完全一致。 */
function isSameSummaryValue(left: unknown, right: unknown) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
    )
  }
  return Object.is(left, right)
}

/** 判断新汇总行是否与当前固定底部行保持相同展示结果。 */
function isSameSummaryRow(currentRow: Row | undefined, nextRow: Row) {
  if (!currentRow) {
    return false
  }
  const currentFields = Object.keys(currentRow)
  const nextFields = Object.keys(nextRow)
  return (
    currentFields.length === nextFields.length &&
    currentFields.every((field) => isSameSummaryValue(currentRow[field], nextRow[field]))
  )
}

function updateSummary() {
  const hasConfiguredSummary =
    columnSettingEnabled.value && columnSettingSummaryFields.value.size > 0
  if (!props.summary && !hasConfiguredSummary) {
    if (pinnedBottomRowData.value.length) {
      pinnedBottomRowData.value = []
    }
    return
  }
  const summaryConfig =
    props.summary === true
      ? { label: '合计', scope: 'filtered' as const }
      : props.summary || { label: '合计', scope: 'filtered' as const }
  const rows =
    summaryConfig.scope === 'all' || !gridApi.value ? normalizedRows.value : getDisplayedRows()
  const summaryColumns: DataGridColumn<Row>[] = props.columns.map((column) => {
    const summaryEnabled = columnSettingEnabled.value
      ? columnSettingSummaryFields.value.has(String(column.field))
      : isDataGridColumnSummaryEnabledByDefault(column)
    return {
      ...column,
      summary: summaryEnabled ? column.summary || { method: 'sum' as const } : false,
    }
  })
  const summaryRow = createSummaryRow<Row>(
    rows,
    summaryColumns,
    summaryConfig,
    summaryLabelTarget.value === 'business' ? undefined : DATA_GRID_SUMMARY_LABEL_FIELD,
  )
  if (isSameSummaryRow(pinnedBottomRowData.value[0], summaryRow)) {
    return
  }
  rowIdentity.getOrCreateInternalKey(summaryRow)
  pinnedBottomRowData.value = [summaryRow]
}

function commitRowOrder(
  change: DataGridRowOrderChange<Row>,
  beforeRowKeys: Array<string | number>,
) {
  const rows = change.rows.slice()
  pendingRows.value = rows
  selection.clear()
  emit('update:modelValue', rows)
  emit('row-order-change', { ...change, rows })
  emit('data-change', {
    source: 'drag',
    rows,
    changes: [],
    rowOrderChange: { ...change, rows },
  })
  if (historyConfig.value) {
    historyManager.push({
      source: 'drag',
      beforeRowKeys,
      afterRowKeys: rows.map((row, index) => getRowIdentity(row)),
    })
  }
  nextTick(updateSummary)
}

/** 提交当前编辑值并打开复制行设置弹窗。 */
async function openRowCopy() {
  if (rowCopyDisabledReason.value) {
    dataGridMessage.warning(rowCopyDisabledReason.value)
    return
  }
  gridApi.value?.stopEditing()
  await nextTick()
  const selectedRows = rowSelectionManager.getSelectedRows()
  if (selectedRows.length !== 1) {
    dataGridMessage.warning('所选数据不在当前表格中，请重新选择')
    return
  }
  rowCopySourceKey.value = getRowIdentity(selectedRows[0])
  rowCopyDialogRef.value?.open()
}

/** 临时高亮复制副本，并在追加式复制后定位到首条新增数据。 */
function revealCopiedRows(insertedRows: Row[], mode: DataGridRowCopyMode) {
  window.requestAnimationFrame(() => {
    const api = gridApi.value
    if (!api) {
      return
    }
    const rowNodes = insertedRows.flatMap((row) => {
      const rowNode = api.getRowNode(encodeDataGridRowKey(getRowIdentity(row)))
      return rowNode ? [rowNode] : []
    })
    if (!rowNodes.length) {
      return
    }
    if (mode === 'append') {
      const firstDisplayIndex = rowNodes.find((node) => node.rowIndex !== null)?.rowIndex
      if (firstDisplayIndex !== undefined && firstDisplayIndex !== null) {
        api.ensureIndexVisible(firstDisplayIndex, 'middle')
      }
    }
    api.flashCells({
      rowNodes,
      flashDuration: 1000,
      fadeDuration: 1200,
    })
  })
}

/** 按弹窗设置复制源行并提交单次复制行事务。 */
function confirmRowCopy(form: { count: number; mode: DataGridRowCopyMode }) {
  if (props.disabled || props.loading) {
    return
  }
  const sourceRowKey = rowCopySourceKey.value
  if (sourceRowKey === undefined) {
    return
  }
  const sourceDataIndex = normalizedRows.value.findIndex((row) =>
    Object.is(getRowIdentity(row), sourceRowKey),
  )
  const sourceRow = normalizedRows.value[sourceDataIndex]
  if (!sourceRow) {
    dataGridMessage.warning('所选数据已发生变化，请重新选择')
    return
  }
  const clonedRows = Array.from({ length: form.count }, () => cloneDataGridRow(sourceRow))
  let insertedRows: Row[]
  try {
    insertedRows = rowCopyConfig.value
      ? rowCopyConfig.value.processInsertedRows(clonedRows)
      : clonedRows
  } catch {
    dataGridMessage.error('复制行数据处理失败，请检查 processInsertedRows 配置')
    return
  }
  const existingRows = new Set(normalizedRows.value)
  const validInsertedRows =
    Array.isArray(insertedRows) &&
    insertedRows.length === clonedRows.length &&
    insertedRows.every(
      (row) => row && typeof row === 'object' && !Array.isArray(row) && !existingRows.has(row),
    ) &&
    new Set(insertedRows).size === insertedRows.length
  if (!validInsertedRows) {
    dataGridMessage.error('processInsertedRows 必须返回数量相同且对象引用互不重复的新行数组')
    return
  }
  insertedRows.forEach((row) => rowIdentity.getOrCreateInternalKey(row))
  const insertDataIndex = form.mode === 'insert' ? sourceDataIndex + 1 : normalizedRows.value.length
  const rows = normalizedRows.value.slice()
  rows.splice(insertDataIndex, 0, ...insertedRows)
  pendingRows.value = rows
  selection.clear()
  emit('update:modelValue', rows)
  emit('data-change', {
    source: 'copy',
    rows,
    changes: [],
    insertedRows,
  })
  emit('row-copy', {
    sourceRow,
    sourceDataIndex,
    sourceRowKey,
    count: form.count,
    mode: form.mode,
    insertDataIndex,
    insertedRows,
    rows,
  })
  if (historyConfig.value) {
    historyManager.push({
      source: 'copy',
      insertDataIndex,
      sourceRowKey,
      insertedRows,
    })
  }
  nextTick(() => {
    rowSelectionManager.setSelectedRowKeys([sourceRowKey])
    revealCopiedRows(insertedRows, form.mode)
    updateSummary()
  })
}

/** 清理已删除行关联的草稿、校验错误和单元格异步任务。 */
function clearRemovedRowState(rowKeys: Set<DataGridRowKey>) {
  persistentEdit.prune((draft) => !rowKeys.has(draft.rowKey))
  rowKeys.forEach((rowKey) => {
    validationManager.abortRow(rowKey)
    validationManager.clearErrors(rowKey)
    cellLoading.clearCellLoading(rowKey)
  })
}

/** 删除当前已加载数据中的全部选中行，并提交一次可撤销的数据事务。 */
function removeSelectedRows() {
  if (props.mode !== 'edit' || props.disabled || props.loading || !rowSelectionConfig.value) {
    return []
  }
  const selectedRowKeys = new Set(rowSelectionManager.getSelectedRowKeys())
  if (!selectedRowKeys.size) {
    return []
  }
  const removedItems = normalizedRows.value.flatMap((row, dataIndex) => {
    const rowKey = getRowIdentity(row)
    return selectedRowKeys.has(rowKey) ? [{ row, rowKey, dataIndex }] : []
  })
  if (!removedItems.length) {
    return []
  }
  const removedRowKeys = new Set(removedItems.map((item) => item.rowKey))
  const removedRows = removedItems.map((item) => item.row)
  const rows = normalizedRows.value.filter(
    (row, dataIndex) => !removedRowKeys.has(getRowIdentity(row)),
  )
  pendingRows.value = rows
  pasteManager.cancel()
  selection.clear()
  rowSelectionManager.clearRowSelection()
  emit('update:modelValue', rows)
  emit('data-change', {
    source: 'remove',
    rows,
    changes: [],
    removedRows,
  })
  clearRemovedRowState(removedRowKeys)
  if (historyConfig.value) {
    historyManager.push({
      source: 'remove',
      removedItems,
    })
  }
  nextTick(updateSummary)
  return removedRows
}

function createCandidateRow(
  previousRow: Row,
  rowChanges: DataGridPendingChange[],
  source: 'edit' | 'paste',
  dataIndex: number,
) {
  return createDataGridCandidateRow(previousRow, rowChanges, source, dataIndex, {
    columns: props.columns,
    getRowKey: getRowIdentity,
    processRowChange: props.processRowChange,
  })
}

function commitChanges(
  pendingChanges: DataGridPendingChange[],
  source: 'edit' | 'paste',
  baseRows: Row[] = normalizedRows.value,
  appendedRowCount = 0,
) {
  if (
    (!pendingChanges.length && !appendedRowCount) ||
    ((props.clipboard || props.history) && !hasStableRowKey())
  ) {
    if (!hasStableRowKey()) {
      emitClipboardError(-1, '', '', '启用复制粘贴或历史记录时必须提供稳定 rowKey')
    }
    return { changes: [], appendedRows: [], rows: baseRows, errors: [] }
  }
  const transaction = applyDataGridRowTransaction(baseRows, pendingChanges, source, {
    columns: props.columns,
    getRowKey: getRowIdentity,
    processRowChange: props.processRowChange,
  })
  if (transaction.errors.length) {
    return { changes: [], appendedRows: [], rows: baseRows, errors: transaction.errors }
  }
  const { changes: valueChanges, rows } = transaction
  rows.forEach((row, dataIndex) => {
    const previousRow = baseRows[dataIndex]
    if (previousRow && previousRow !== row) {
      rowIdentity.inheritInternalKey(previousRow, row)
    }
  })
  const appendedRows = appendedRowCount ? rows.slice(rows.length - appendedRowCount) : []
  if (!valueChanges.length && !appendedRows.length) {
    return { changes: [], appendedRows: [], rows: baseRows, errors: transaction.errors }
  }
  pendingRows.value = rows
  emit('update:modelValue', rows)
  emit('data-change', { source, rows, changes: valueChanges, appendedRows })
  if (historyConfig.value) {
    historyManager.push({
      source,
      changes: valueChanges.filter((change) => change.dataIndex < normalizedRows.value.length),
      appendedRows,
    })
  }
  if (source === 'edit') {
    const directChange = pendingChanges[0]
    const row = rows[directChange.dataIndex]
    const valueChange = valueChanges.find(
      (change) =>
        change.dataIndex === directChange.dataIndex && change.field === directChange.field,
    )
    if (row && valueChange) {
      emit('cell-change', {
        row,
        dataIndex: directChange.dataIndex,
        field: valueChange.field,
        oldValue: valueChange.oldValue,
        newValue: valueChange.newValue,
      })
    }
  }
  nextTick(updateSummary)
  return { changes: valueChanges, appendedRows, rows, errors: transaction.errors }
}

function applyHistoryEntry(entry: DataGridHistoryEntry<Row>, source: 'undo' | 'redo') {
  if (entry.source === 'drag') {
    const targetRowKeys = source === 'undo' ? entry.beforeRowKeys : entry.afterRowKeys
    const rowMap = new Map(
      normalizedRows.value.flatMap((row) => {
        const rowKey = getRowIdentity(row)
        return rowKey !== undefined ? [[rowKey, row]] : []
      }),
    )
    const rows = targetRowKeys.flatMap<Row>((rowKey) => {
      const row = rowMap.get(rowKey)
      return row ? [row] : []
    })
    if (rows.length !== normalizedRows.value.length) {
      return false
    }
    pendingRows.value = rows
    selection.clear()
    emit('update:modelValue', rows)
    emit('data-change', {
      source,
      rows,
      changes: [],
    })
    nextTick(updateSummary)
    return true
  }
  if (entry.source === 'copy') {
    const insertedKeys = new Set(entry.insertedRows.map((row) => getRowIdentity(row)))
    let rows = normalizedRows.value.slice()
    let insertedRows: Row[] = []
    let removedRows: Row[] = []
    if (source === 'undo') {
      removedRows = rows.filter((row) => insertedKeys.has(getRowIdentity(row)))
      rows = rows.filter((row) => !insertedKeys.has(getRowIdentity(row)))
    } else {
      const existingKeys = new Set(rows.map((row) => getRowIdentity(row)))
      insertedRows = entry.insertedRows.filter((row) => !existingKeys.has(getRowIdentity(row)))
      rows.splice(Math.min(entry.insertDataIndex, rows.length), 0, ...insertedRows)
    }
    if (!(source === 'undo' ? removedRows.length : insertedRows.length)) {
      return false
    }
    pendingRows.value = rows
    selection.clear()
    emit('update:modelValue', rows)
    emit('data-change', {
      source,
      rows,
      changes: [],
      insertedRows: source === 'redo' ? insertedRows : [],
      removedRows,
    })
    removedRows.forEach((row) => {
      const rowKey = getRowIdentity(row)
      validationManager.abortRow(rowKey)
      validationManager.clearErrors(rowKey)
    })
    nextTick(() => {
      const sourceRowExists = rows.some((row) => Object.is(getRowIdentity(row), entry.sourceRowKey))
      rowSelectionManager.setSelectedRowKeys(sourceRowExists ? [entry.sourceRowKey] : [])
      updateSummary()
    })
    return true
  }
  if (entry.source === 'remove') {
    const removedRowKeys = new Set(entry.removedItems.map((item) => item.rowKey))
    let rows = normalizedRows.value.slice()
    const insertedRows: Row[] = []
    let removedRows: Row[] = []
    if (source === 'undo') {
      const existingRowKeys = new Set(rows.map((row, index) => getRowIdentity(row)))
      entry.removedItems
        .filter((item) => !existingRowKeys.has(item.rowKey))
        .sort((left, right) => left.dataIndex - right.dataIndex)
        .forEach((item) => {
          rows.splice(Math.min(item.dataIndex, rows.length), 0, item.row)
          insertedRows.push(item.row)
        })
    } else {
      removedRows = rows.filter((row, index) => removedRowKeys.has(getRowIdentity(row)))
      rows = rows.filter((row, index) => !removedRowKeys.has(getRowIdentity(row)))
    }
    if (!(source === 'undo' ? insertedRows.length : removedRows.length)) {
      return false
    }
    pendingRows.value = rows
    pasteManager.cancel()
    selection.clear()
    rowSelectionManager.clearRowSelection()
    emit('update:modelValue', rows)
    emit('data-change', {
      source,
      rows,
      changes: [],
      insertedRows,
      removedRows,
    })
    if (source === 'redo') {
      clearRemovedRowState(removedRowKeys)
    }
    nextTick(updateSummary)
    return true
  }
  let rows = normalizedRows.value.slice()
  const appendedRows = entry.appendedRows || []
  const appendedKeys = new Set(appendedRows.map((row, index) => getRowIdentity(row)))
  let removedRows: Row[] = []
  const removedRowKeys = new Set<string | number>()
  if (source === 'undo' && appendedKeys.size) {
    removedRows = rows.filter((row, index) => appendedKeys.has(getRowIdentity(row)))
    removedRows.forEach((row) => {
      const dataIndex = normalizedRows.value.indexOf(row)
      removedRowKeys.add(getRowIdentity(row))
    })
    rows = rows.filter((row, index) => !appendedKeys.has(getRowIdentity(row)))
  }
  if (source === 'redo' && appendedRows.length) {
    const existingKeys = new Set(rows.map((row, index) => getRowIdentity(row)))
    rows = [...rows, ...appendedRows.filter((row, index) => !existingKeys.has(getRowIdentity(row)))]
  }
  const dataIndexes = new Map<string | number, number>()
  rows.forEach((row, index) => dataIndexes.set(getRowIdentity(row), index))
  const groupedChanges = new Map<number, DataGridValueChange<Row>[]>()

  entry.changes.forEach((change) => {
    const dataIndex = dataIndexes.get(change.rowKey)
    if (dataIndex === undefined) {
      return
    }
    const changes = groupedChanges.get(dataIndex) || []
    changes.push(change)
    groupedChanges.set(dataIndex, changes)
  })
  if (!groupedChanges.size && !appendedRows.length) {
    return false
  }

  const appliedChanges: DataGridValueChange<Row>[] = []
  groupedChanges.forEach((changes, dataIndex) => {
    const previousRow = rows[dataIndex]
    let row = previousRow
    changes.forEach((change) => {
      const newValue = source === 'undo' ? change.oldValue : change.newValue
      const oldValue = getFieldValue(row, change.field)
      row = setFieldValue(row, change.field, newValue)
      appliedChanges.push({
        ...change,
        dataIndex,
        oldValue,
        newValue,
        row,
      })
    })
    rows[dataIndex] = row
    if (previousRow !== row) {
      rowIdentity.inheritInternalKey(previousRow, row)
    }
    appliedChanges.forEach((change) => {
      if (change.dataIndex === dataIndex) {
        change.row = row
      }
    })
  })

  pendingRows.value = rows
  emit('update:modelValue', rows)
  emit('data-change', {
    source,
    rows,
    changes: appliedChanges,
    appendedRows: source === 'redo' ? appendedRows : [],
    removedRows,
  })
  removedRowKeys.forEach((rowKey) => {
    validationManager.abortRow(rowKey)
    validationManager.clearErrors(rowKey)
  })
  nextTick(updateSummary)
  nextTick(() => {
    groupedChanges.forEach((changes, dataIndex) => {
      const row = rows[dataIndex]
      if (row) {
        const changedFields = [...new Set(changes.map((change) => change.field))]
        void validateTableRow(row, 'edit', {
          changedFields,
          fields: changedFields,
        })
      }
    })
    if (source === 'redo' && appendedKeys.size) {
      rows.forEach((row, dataIndex) => {
        if (appendedKeys.has(getRowIdentity(row)) && !groupedChanges.has(dataIndex)) {
          void validateTableRow(row, 'edit')
        }
      })
    }
  })
  return true
}

function onGridReady(event: GridReadyEvent<Row>) {
  gridApi.value = event.api
  validationViewVersion.value++
  rowSelectionManager.initialize()
  initializeColumnSetting()
  updateSummary()
  nextTick(refreshMergedCells)
  emit('grid-ready', { rowCount: normalizedRows.value.length })
}

function onNewColumnsLoaded() {
  closePopupEditor()
  validationViewVersion.value++
  initializeColumnSetting()
}

/** 将单个编辑值提交到 DataGrid 事务链，并执行当前行的增量校验。 */
function commitCellValue(row: Row, field: string, newValue: unknown) {
  const dataIndex = findDataIndex(row)
  const column = props.columns.find((item) => item.field === field)
  if (
    dataIndex < 0 ||
    !column ||
    !isDataGridCellEditable(
      column,
      row,
      props.mode,
      props.disabled || props.loading,
      dataIndex,
      dataIndex,
    ) ||
    cellLoading.isCellInteractionBlocked(getRowIdentity(row), field)
  ) {
    return false
  }
  const result = commitChanges(
    [
      {
        dataIndex,
        field: column.field,
        newValue: normalizeEditorValue(newValue, column.editor, {
          row,
          dataIndex,
          displayIndex: dataIndex,
          field: column.field,
          value: newValue,
        }),
      },
    ],
    'edit',
  )
  if (result.errors.length) {
    const error = result.errors[0]
    const rowKey = getRowIdentity(row)
    validationManager.setErrors([
      ...validationManager.getErrors().filter((item) => !Object.is(item.rowKey, rowKey)),
      {
        rowKey,
        dataIndex,
        field: column.field,
        columnTitle: column.title,
        value: newValue,
        message: error.message,
        row,
        trigger: 'edit',
        source: 'row',
      },
    ])
    return false
  }
  const nextRow = result.rows[dataIndex]
  if (nextRow && result.changes.length) {
    const fields = [
      ...new Set(
        result.changes
          .filter((change) => change.dataIndex === dataIndex)
          .map((change) => change.field),
      ),
    ]
    void validateTableRow(nextRow, 'edit', {
      previousRow: row,
      changedFields: [column.field],
      fields,
    })
  }
  return true
}

function onCellEditRequest(event: CellEditRequestEvent<Row>) {
  const field = event.colDef.field
  if (field && event.data) {
    commitCellValue(event.data, field, event.newValue)
  }
}

function onFilterChanged(event: FilterChangedEvent<Row>) {
  closePopupEditor()
  pasteManager.cancel()
  validationViewVersion.value++
  updateSummary()
  rowIndex.refresh()
  rowDrag.refreshHandles()
  nextTick(refreshMergedCells)
  if (historyConfig.value && historyConfig.value.clearOnFilter !== false) {
    historyManager.clear()
  }
  emit('filter-change', convertFilterModel(event.api.getFilterModel()))
}

function onSortChanged(event: SortChangedEvent<Row>) {
  closePopupEditor()
  pasteManager.cancel()
  validationViewVersion.value++
  rowIndex.refresh()
  rowDrag.refreshHandles()
  nextTick(refreshMergedCells)
  if (historyConfig.value && historyConfig.value.clearOnSort !== false) {
    historyManager.clear()
  }
  const sorts: DataGridSortItem[] = event.api
    .getColumnState()
    .filter((column) => column.sort)
    .map((column) => ({ field: column.colId, order: column.sort as 'asc' | 'desc' }))
  emit('sort-change', sorts)
}

function onColumnMoved(event: ColumnMovedEvent<Row>) {
  if (event.finished && isUserColumnSettingSource(event.source)) {
    validationViewVersion.value++
    if (historyConfig.value) {
      historyManager.clear()
    }
    persistColumnSetting('grid', 'order')
    nextTick(refreshMergedCells)
  }
}

function isUserColumnSettingSource(source: ColumnEventType) {
  return [
    'uiColumnMoved',
    'uiColumnDragged',
    'uiColumnResized',
    'toolPanelDragAndDrop',
    'toolPanelUi',
    'columnMenu',
    'contextMenu',
  ].includes(source)
}

function getColumnEventFields(
  event: ColumnVisibleEvent<Row> | ColumnPinnedEvent<Row> | ColumnResizedEvent<Row>,
) {
  return (
    event.columns?.map((column) => column.getColId()) ??
    (event.column ? [event.column.getColId()] : [])
  )
}

function onColumnVisible(event: ColumnVisibleEvent<Row>) {
  if (!isUserColumnSettingSource(event.source)) {
    return
  }
  validationViewVersion.value++
  scheduleColumnSettingPersist('visibility', getColumnEventFields(event))
  nextTick(refreshMergedCells)
}

function onColumnPinned(event: ColumnPinnedEvent<Row>) {
  if (!isUserColumnSettingSource(event.source)) {
    return
  }
  scheduleColumnSettingPersist('fixed', getColumnEventFields(event))
  nextTick(refreshMergedCells)
}

function onColumnResized(event: ColumnResizedEvent<Row>) {
  if (event.finished && event.source === 'uiColumnResized') {
    const fields = event.column ? [event.column.getColId()] : getColumnEventFields(event)
    scheduleColumnSettingPersist('width', fields)
  }
}

let columnResizeSession: DataGridColumnResizeSession | undefined

/** 清理 DataGrid 接管的表头列宽拖拽监听。 */
function clearColumnResizeSession() {
  const session = columnResizeSession
  if (session?.handle.hasPointerCapture(session.pointerId)) {
    session.handle.releasePointerCapture(session.pointerId)
  }
  window.removeEventListener('pointermove', onColumnResizePointerMove)
  window.removeEventListener('pointerup', onColumnResizePointerUp)
  window.removeEventListener('pointercancel', onColumnResizePointerUp)
  columnResizeSession = undefined
}

/** 使用稳定列标识更新当前指针拖拽对应的业务列。 */
function resizeColumnByPointer(event: PointerEvent, finished: boolean) {
  const session = columnResizeSession
  const api = gridApi.value
  if (!session || !api || event.pointerId !== session.pointerId) {
    return
  }
  const distance = (event.clientX - session.startX) * (session.pinnedRight ? -1 : 1)
  api.setColumnWidths(
    [{ key: session.column.getColId(), newWidth: session.startWidth + distance }],
    finished,
    'uiColumnResized',
  )
}

/** 持续响应表头列宽手柄的 Pointer 拖拽。 */
function onColumnResizePointerMove(event: PointerEvent) {
  if (!columnResizeSession || event.pointerId !== columnResizeSession.pointerId) {
    return
  }
  event.preventDefault()
  resizeColumnByPointer(event, false)
}

/** 完成本次列宽拖拽并触发 DataGrid 列配置缓存。 */
function onColumnResizePointerUp(event: PointerEvent) {
  const session = columnResizeSession
  if (!session || event.pointerId !== session.pointerId) {
    return
  }
  event.preventDefault()
  resizeColumnByPointer(event, true)
  clearColumnResizeSession()
}

/**
 * 使用 Pointer capture 接管 AG Grid 表头列宽手柄，保证嵌套滚动容器中的拖拽链不会丢失。
 */
function onColumnResizePointerDown(event: PointerEvent) {
  if (event.button !== 0 || !(event.target instanceof Element)) {
    return
  }
  const handle = event.target.closest<HTMLElement>('.ag-header-cell-resize')
  const header = handle?.closest<HTMLElement>('[role="columnheader"][col-id]')
  const column = header ? gridApi.value?.getColumn(header.getAttribute('col-id') ?? '') : undefined
  if (!handle || !column || !column.isResizable()) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  clearColumnResizeSession()
  columnResizeSession = {
    pointerId: event.pointerId,
    column,
    startX: event.clientX,
    startWidth: column.getActualWidth(),
    pinnedRight: column.getPinned() === 'right',
    handle,
  }
  handle.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onColumnResizePointerMove, { passive: false })
  window.addEventListener('pointerup', onColumnResizePointerUp, { passive: false })
  window.addEventListener('pointercancel', onColumnResizePointerUp, { passive: false })
}

function isTextInputTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(
    element?.isContentEditable || element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA',
  )
}

/** 判断输入控件内是否存在应优先交给浏览器复制的文字选区。 */
function hasNativeTextSelection(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return (
      element.selectionStart !== null &&
      element.selectionEnd !== null &&
      element.selectionStart !== element.selectionEnd
    )
  }
  if (element?.isContentEditable) {
    return !window.getSelection()?.isCollapsed
  }
  return false
}

function getColumn(field: string) {
  return props.columns.find((column) => column.field === field)
}

function formatClipboardValue(
  column: DataGridColumn<Row>,
  value: unknown,
  row: Row,
  displayIndex: number,
) {
  if (column.clipboard && column.clipboard.formatter) {
    return column.clipboard.formatter(value, row)
  }
  if (column.options && isColumnOptionsLoading(column)) {
    return String(value ?? '')
  }
  if (column.options && !isColumnOptionsLoading(column)) {
    return formatOptionValue(getColumnOptions(column), value) ?? String(value ?? '')
  }
  if (column.formatter) {
    return column.formatter(value, row, displayIndex)
  }
  return String(value ?? '')
}

function createSelectionClipboardContent(
  options: DataGridCopySelectionOptions = {},
  copyWholeRows = false,
): DataGridClipboardContent | undefined {
  const api = gridApi.value
  const bounds = selection.getBounds()
  if (!api || !bounds || !clipboardConfig.value || clipboardConfig.value.copy === false) {
    return
  }
  const selectedColumns = copyWholeRows
    ? bounds.columns
    : bounds.columns.slice(bounds.startColumnIndex, bounds.endColumnIndex + 1)
  if (!selectedColumns.length) {
    return
  }
  const matrix: unknown[][] = []
  const copiedDisplayIndexes: number[] = []
  const includeHeaders = options.includeHeaders ?? clipboardConfig.value.copyHeaders
  if (includeHeaders) {
    matrix.push(selectedColumns.map((column) => getColumn(column.getColId())?.title ?? ''))
  }
  for (
    let displayIndex = bounds.startDisplayIndex;
    displayIndex <= bounds.endDisplayIndex;
    displayIndex += 1
  ) {
    const row = api.getDisplayedRowAtIndex(displayIndex)?.data
    if (!row) {
      continue
    }
    copiedDisplayIndexes.push(displayIndex)
    matrix.push(
      selectedColumns.map((agColumn) => {
        const column = getColumn(agColumn.getColId())
        if (!column || column.clipboard === false || column.clipboard?.copy === false) {
          return ''
        }
        if (cellMerge.isCoveredByColumnMerge(displayIndex, agColumn.getColId())) {
          return ''
        }
        const value = getFieldValue(row, column.field)
        return formatClipboardValue(column, value, row, displayIndex)
      }),
    )
  }
  if (!copiedDisplayIndexes.length) {
    return
  }
  const firstColumn = selectedColumns[0]
  const lastColumn = selectedColumns[selectedColumns.length - 1]
  const range = copyWholeRows
    ? {
        start: { displayIndex: copiedDisplayIndexes[0], field: firstColumn.getColId() },
        end: {
          displayIndex: copiedDisplayIndexes[copiedDisplayIndexes.length - 1],
          field: lastColumn.getColId(),
        },
      }
    : selection.getRange()
  return {
    text: serializeClipboardMatrix(matrix),
    range,
    rowCount: copiedDisplayIndexes.length,
    columnCount: selectedColumns.length,
  }
}

function emitClipboardError(
  displayIndex: number,
  field: string,
  text: string,
  message: string,
  row?: Row,
) {
  const column = getColumn(field)
  const resolvedField = column?.field ?? ''
  const error: DataGridClipboardError<Row> = {
    displayIndex,
    field: resolvedField,
    columnTitle: column?.title ?? field,
    text,
    message,
    row,
  }
  if (row && displayIndex >= 0 && column) {
    const dataIndex = findDataIndex(row)
    const rowKey = getRowIdentity(row)
    const retainedErrors = validationManager
      .getErrors()
      .filter((item) => !Object.is(item.rowKey, rowKey) || item.field !== resolvedField)
    validationManager.setErrors([
      ...retainedErrors,
      {
        rowKey,
        dataIndex,
        field: column.field,
        columnTitle: column.title,
        value: getFieldValue(row, column.field),
        message,
        row,
        trigger: 'paste',
        source: 'column',
      },
    ])
  }
  emit('clipboard-error', error)
  dataGridMessage.error(message)
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

async function writeClipboardText(text: string) {
  let clipboardError: unknown
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (error) {
      clipboardError = error
    }
  }
  if (fallbackCopyText(text)) {
    return
  }
  throw clipboardError ?? new Error('浏览器拒绝访问剪贴板')
}

async function copyClipboardContent(content?: DataGridClipboardContent) {
  if (!content) {
    return false
  }
  try {
    await writeClipboardText(content.text)
    emit('clipboard-copy', { text: content.text, range: content.range })
    return true
  } catch (error) {
    emitClipboardError(
      -1,
      '',
      content.text,
      error instanceof Error ? error.message : '浏览器拒绝访问剪贴板',
    )
    return false
  }
}

async function copySelection(options: DataGridCopySelectionOptions = {}) {
  return copyClipboardContent(createSelectionClipboardContent(options))
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

function onCellContextMenu(event: CellContextMenuEvent<Row>) {
  const field = event.column.getColId()
  const column = getColumn(field)
  const mouseEvent = event.event as MouseEvent | undefined
  if (isTextInputTarget(mouseEvent?.target ?? null)) {
    closeContextMenu()
    return
  }
  if (
    !clipboardConfig.value ||
    clipboardConfig.value.copy === false ||
    event.rowIndex === null ||
    event.rowPinned ||
    !event.data ||
    field === DATA_GRID_ROW_DRAG_COLUMN_ID ||
    field === DATA_GRID_ROW_INDEX_COLUMN_ID ||
    !column ||
    column.clipboard === false ||
    column.clipboard?.copy === false ||
    !mouseEvent
  ) {
    closeContextMenu()
    return
  }
  mouseEvent.preventDefault()
  if (!selection.contains(event.rowIndex, field)) {
    selection.select({ displayIndex: event.rowIndex, columnId: field })
  }
  gridApi.value?.setFocusedCell(event.rowIndex, event.column)
  contextMenuX.value = mouseEvent.clientX
  contextMenuY.value = mouseEvent.clientY
  contextMenuVisible.value = true
}

function onGridContextMenu(event: MouseEvent) {
  if (
    !clipboardConfig.value ||
    clipboardConfig.value.copy === false ||
    isTextInputTarget(event.target)
  ) {
    return
  }
  const target = event.target as HTMLElement | null
  if (
    target?.closest(
      '[col-id^="ag-Grid-ControlsColumn"], [col-id="__dataGridRowDrag"], [col-id="__dataGridRowIndex"]',
    )
  ) {
    return
  }
  if (target?.closest('.ag-cell')) {
    event.preventDefault()
  }
}

async function copyFromContextMenu(includeHeaders: boolean, copyWholeRows = false) {
  const content = createSelectionClipboardContent({ includeHeaders }, copyWholeRows)
  closeContextMenu()
  if (!content || !(await copyClipboardContent(content))) {
    return
  }
  dataGridMessage.success(`已复制 ${content.rowCount} 行 × ${content.columnCount} 列`)
}

function onNativeCopy(event: ClipboardEvent) {
  if (isTextInputTarget(event.target) && hasNativeTextSelection(event.target)) {
    return
  }
  const content = createSelectionClipboardContent()
  if (!content || !event.clipboardData) {
    return
  }
  event.preventDefault()
  event.clipboardData.setData('text/plain', content.text)
  emit('clipboard-copy', { text: content.text, range: content.range })
  dataGridMessage.success('已复制到剪贴板')
}

/** 当表格选区仍激活但 DOM 焦点丢失到页面根节点时，继续处理原生快捷键复制事件。 */
function onDocumentCopy(event: ClipboardEvent) {
  if (
    !isActiveDataGridClipboardOwner(clipboardOwner) ||
    event.defaultPrevented ||
    containerRef.value?.contains(event.target as Node)
  ) {
    return
  }
  if (
    event.target !== document &&
    event.target !== document.body &&
    event.target !== document.documentElement
  ) {
    return
  }
  onNativeCopy(event)
}

onMounted(() => document.addEventListener('copy', onDocumentCopy))
onBeforeUnmount(() => {
  document.removeEventListener('copy', onDocumentCopy)
  toolbarResizeObserver?.disconnect()
  clearColumnResizeSession()
  releaseDataGridClipboardOwner(clipboardOwner)
})

function onNativePaste(event: ClipboardEvent) {
  if (isTextInputTarget(event.target) || !event.clipboardData) {
    return
  }
  if (!clipboardConfig.value || clipboardConfig.value.paste === false) {
    return
  }
  if (props.mode !== 'edit' || props.disabled) {
    event.preventDefault()
    dataGridMessage.warning('当前表格为只读状态，不能粘贴')
    return
  }
  if (props.loading) {
    event.preventDefault()
    dataGridMessage.warning('表格数据加载中，暂时不能粘贴')
    return
  }
  if (!gridApi.value || !selection.getBounds()) {
    event.preventDefault()
    dataGridMessage.warning('请先选择要粘贴的单元格')
    return
  }
  const text = event.clipboardData.getData('text/plain')
  event.preventDefault()
  void pasteText(text)
}

function undo() {
  if (!historyConfig.value || props.mode !== 'edit' || props.disabled || props.loading) {
    return false
  }
  const entry = historyManager.takeUndo()
  return entry ? applyHistoryEntry(entry, 'undo') : false
}

function redo() {
  if (!historyConfig.value || props.mode !== 'edit' || props.disabled || props.loading) {
    return false
  }
  const entry = historyManager.takeRedo()
  return entry ? applyHistoryEntry(entry, 'redo') : false
}

function canUndo() {
  return (
    props.mode === 'edit' && !props.disabled && !props.loading && historyManager.getState().canUndo
  )
}

function canRedo() {
  return (
    props.mode === 'edit' && !props.disabled && !props.loading && historyManager.getState().canRedo
  )
}

function clearHistory() {
  historyManager.clear()
}

function onNativeKeyDown(event: KeyboardEvent) {
  if (isTextInputTarget(event.target)) {
    return
  }
  const commandKey = event.ctrlKey || event.metaKey
  if (!commandKey) {
    return
  }
  const key = event.key.toLowerCase()
  if (key === 'z' && !event.shiftKey && undo()) {
    event.preventDefault()
    return
  }
  if ((key === 'y' || (key === 'z' && event.shiftKey)) && redo()) {
    event.preventDefault()
  }
}

function clearFilters() {
  gridApi.value?.setFilterModel(null)
}

function resetColumns() {
  if (columnSettingEnabled.value) {
    resetColumnSetting()
  } else {
    gridApi.value?.resetColumnState()
  }
  if (historyConfig.value) {
    historyManager.clear()
  }
}

function refresh() {
  gridApi.value?.refreshCells({ force: true })
  refreshMergedCells()
  updateSummary()
}

function refreshMergedCells() {
  if (!hasCellMerge.value) {
    return
  }
  gridApi.value?.redrawRows()
}

function scrollToRow(rowKey: DataGridRowKey) {
  const displayIndex = findDisplayIndex(rowKey)
  if (displayIndex >= 0) {
    gridApi.value?.ensureIndexVisible(displayIndex, 'middle')
  }
}

function scrollToCell(rowKey: DataGridRowKey, field: string) {
  const api = gridApi.value
  const displayIndex = findDisplayIndex(rowKey)
  if (displayIndex < 0) {
    return
  }
  const mergeRange = cellMerge.getCellMergeRange(displayIndex, field)
  const targetDisplayIndex = mergeRange?.start.displayIndex ?? displayIndex
  const targetField = mergeRange?.start.columnId ?? field
  const column = api?.getColumn(targetField)
  if (!api || !column) {
    return
  }
  api.ensureIndexVisible(targetDisplayIndex, 'middle')
  api.ensureColumnVisible(column)
  api.setFocusedCell(targetDisplayIndex, column)
}

function findDisplayIndex(rowKey: DataGridRowKey) {
  let displayIndex = -1
  gridApi.value?.forEachNodeAfterFilterAndSort((node) => {
    if (displayIndex < 0 && node.data && Object.is(getRowIdentity(node.data), rowKey)) {
      displayIndex = node.rowIndex ?? -1
    }
  })
  return displayIndex
}

function locateValidationItem(item: DataGridValidationCenterItem<Row>) {
  if (item.status !== 'visible' || item.displayIndex < 0) {
    return
  }
  currentValidationErrorKey.value = item.key
  scrollToCell(item.error.rowKey, item.error.field)
}

function locateAdjacentValidationItem(direction: -1 | 1) {
  const items = locatableValidationItems.value
  const currentIndex = items.findIndex((item) => item.key === currentValidationErrorKey.value)
  const target = items[currentIndex + direction]
  if (target) {
    locateValidationItem(target)
  }
}

function clearFiltersAndLocateValidationItem(item: DataGridValidationCenterItem<Row>) {
  currentValidationErrorKey.value = item.key
  gridApi.value?.setFilterModel(null)
  nextTick(() => {
    validationViewVersion.value++
    const displayIndex = findDisplayIndex(item.error.rowKey)
    if (displayIndex >= 0) {
      locateValidationItem({
        ...item,
        status: 'visible',
        displayIndex,
      })
    }
  })
}

function scrollToFirstValidationError(errors: DataGridValidationError<Row>[]) {
  for (const error of errors) {
    if (!gridApi.value?.getColumn(error.field)?.isVisible()) {
      continue
    }
    const displayIndex = findDisplayIndex(error.rowKey)
    if (displayIndex >= 0) {
      scrollToCell(error.rowKey, error.field)
      return
    }
  }
}

function createValidateRowRequest(
  row: Row,
  trigger: DataGridValidateTrigger,
  options: {
    previousRow?: Row
    changedFields?: DataGridField<Row>[]
    fields?: DataGridField<Row>[]
    includeRowRules?: boolean
  } = {},
): DataGridValidateRowRequest<Row> | undefined {
  const dataIndex = findDataIndex(row)
  if (dataIndex < 0) {
    return undefined
  }
  return {
    row,
    previousRow: options.previousRow,
    dataIndex,
    rowKey: getRowIdentity(row),
    changedFields: options.changedFields ?? props.columns.map((column) => column.field),
    trigger,
    fields: options.fields,
    includeRowRules: options.includeRowRules,
  }
}

async function validateTableRow(
  row: Row,
  trigger: DataGridValidateTrigger = 'submit',
  options: {
    previousRow?: Row
    changedFields?: DataGridField<Row>[]
    fields?: DataGridField<Row>[]
    includeRowRules?: boolean
  } = {},
): Promise<DataGridValidationResult<Row>> {
  const request = createValidateRowRequest(row, trigger, options)
  return request ? validationManager.validateManagedRow(request) : { valid: true, errors: [] }
}

async function validate(
  options: DataGridValidateOptions = {},
): Promise<DataGridValidationResult<Row>> {
  if (!(await flushPersistentDrafts())) {
    return {
      valid: false,
      errors: validationManager.getErrors(),
    }
  }
  const requests = normalizedRows.value.map<DataGridValidateRowRequest<Row>>((row, dataIndex) => ({
    row,
    dataIndex,
    rowKey: getRowIdentity(row),
    changedFields: props.columns.map((column) => column.field),
    trigger: 'submit',
  }))
  const result = await validationManager.validateRows(requests)
  const shouldScroll =
    options.scrollToFirstError ?? validationConfig.value.scrollToFirstError ?? true
  if (!result.valid && shouldScroll) {
    nextTick(() => scrollToFirstValidationError(result.errors))
  }
  return result
}

function validateRow(row: Row, trigger: DataGridValidateTrigger = 'submit') {
  return validateTableRow(row, trigger)
}

function validateField(
  row: Row,
  field: DataGridField<Row>,
  trigger: DataGridValidateTrigger = 'submit',
) {
  return validateTableRow(row, trigger, {
    changedFields: [field],
    fields: [field],
    includeRowRules: false,
  })
}

function clearValidate(options: { row?: Row; field?: string } = {}) {
  const dataIndex = options.row ? findDataIndex(options.row) : -1
  if (options.row && dataIndex < 0) {
    return
  }
  const rowKey = options.row && dataIndex >= 0 ? getRowIdentity(options.row) : undefined
  validationManager.clearErrors(rowKey, options.field)
}

function getValidationErrors() {
  return validationManager.getErrors()
}

function isValidating() {
  return validationManager.isValidating()
}

/** 记录动态可编辑状态发生变化的行，等待 AG Grid 接收最新 RowData 后统一重建。 */
function queueRowsWithChangedEditableState(rows: Row[], previousRows: Row[]) {
  const api = gridApi.value
  if (!api || !previousRows.length) {
    return
  }
  const previousRowsByKey = new Map(previousRows.map((row, index) => [getRowIdentity(row), row]))
  rows.forEach((row, dataIndex) => {
    const rowKey = getRowIdentity(row)
    const previousRow = previousRowsByKey.get(rowKey)
    const rowNode = api.getRowNode(encodeDataGridRowKey(rowKey))
    if (!previousRow || previousRow === row || !rowNode) {
      return
    }
    const displayIndex = rowNode.rowIndex ?? dataIndex
    if (
      hasDataGridRowEditableStateChanged(
        props.columns,
        previousRow,
        row,
        props.mode,
        props.disabled || props.loading,
        dataIndex,
        displayIndex,
      )
    ) {
      pendingEditableStateRowKeys.add(rowKey)
    }
  })
}

/** AG Grid 完成 RowData 更新后重建待处理行，重新执行 RendererSelector、cellClass 和 Tooltip。 */
function onRowDataUpdated() {
  // 此时 AG Grid 已接收最新数据，基于筛选结果重新计算合计才不会读到旧行。
  updateSummary()
  const api = gridApi.value
  if (!api || !pendingEditableStateRowKeys.size) {
    return
  }
  const rowNodes = [...pendingEditableStateRowKeys].flatMap((rowKey) => {
    const rowNode = api.getRowNode(encodeDataGridRowKey(rowKey))
    return rowNode ? [rowNode] : []
  })
  pendingEditableStateRowKeys.clear()
  if (rowNodes.length) {
    api.redrawRows({ rowNodes })
  }
}

/** 判断父组件回写的数据是否确认了最近一次 DataGrid 内部事务。 */
function isPendingRowsAcknowledged(rows: Row[]) {
  const expectedRows = pendingRows.value
  if (!expectedRows || rows.length !== expectedRows.length) {
    return false
  }
  if (rows === expectedRows) {
    return true
  }
  return rows.every((row, dataIndex) => {
    const expectedRow = expectedRows[dataIndex]
    if (!expectedRow || !Object.is(getRowIdentity(row), getRowIdentity(expectedRow))) {
      return false
    }
    return isEqual(row, expectedRow)
  })
}

watch(normalizedRows, (rows, previousRows) => {
  if (isPendingRowsAcknowledged(rows)) {
    pendingRows.value = undefined
    cellLoading.prune(
      new Set(rows.map((row, index) => getRowIdentity(row))),
      new Set(props.columns.map((column) => column.field)),
    )
  } else {
    closePopupEditor()
    pasteManager.cancel()
    if (historyConfig.value) {
      historyManager.clear()
    }
    persistentEdit.clear()
    validationManager.abortAll()
    validationManager.clearErrors()
    cellLoading.clearCellLoading()
  }
  queueRowsWithChangedEditableState(rows, previousRows)
  nextTick(updateSummary)
  nextTick(rowDrag.refreshHandles)
  nextTick(rowIndex.refresh)
  nextTick(refreshMergedCells)
})

watch(
  () => props.rowKey,
  () => {
    persistentEdit.clear()
    validationManager.abortAll()
    cellLoading.clearCellLoading()
  },
)

watch(
  () => props.validation,
  (value) => {
    if (value === false) {
      validationManager.abortAll()
      validationManager.clearErrors()
    }
  },
  { deep: true },
)

watch(
  () => [props.mode, props.editorDisplayMode, props.disabled, props.loading],
  () => {
    if (props.mode !== 'edit' || props.disabled || props.loading) {
      closePopupEditor()
      pasteManager.cancel()
      persistentEdit.clear()
    }
    nextTick(rowDrag.refreshHandles)
  },
)

watch(
  () => props.summary,
  () => nextTick(updateSummary),
  { deep: true },
)

watch(summaryLabelTarget, () => nextTick(updateSummary))

watch(
  () => props.rowNumbering,
  () => nextTick(rowIndex.refresh),
  { deep: true },
)

watch(
  () => props.columns.map((column) => column.field),
  (fields) => {
    pasteManager.cancel()
    selection.clear()
    const activeFields = new Set<string>(fields.map(String))
    const activeRowKeys = new Set(normalizedRows.value.map((row, index) => getRowIdentity(row)))
    persistentEdit.prune(
      (draft) => activeFields.has(draft.field) && activeRowKeys.has(draft.rowKey),
    )
    if (historyConfig.value) {
      historyManager.clear()
    }
    cellLoading.prune(
      new Set(normalizedRows.value.map((row, index) => getRowIdentity(row))),
      new Set(fields),
    )
    nextTick(initializeColumnSetting)
  },
)

watch(
  () =>
    props.columns.map((column) => ({
      field: column.field,
      rowMerge: column.rowMerge,
      columnMerge: column.columnMerge,
    })),
  () => nextTick(refreshMergedCells),
  { deep: true },
)

watch(
  () => props.columnSetting,
  () => nextTick(initializeColumnSetting),
  { deep: true },
)

watch(
  () =>
    props.columns.map((column) => ({
      field: column.field,
      options: column.options ? getColumnOptions(column) : [],
      loading: resolveReactiveValue(column.optionsLoading, false),
    })),
  () => gridApi.value?.refreshCells({ force: true }),
  { deep: true },
)

const tableExpose: DataGridExpose<Row> = {
  clearFilters,
  resetColumns,
  refresh,
  getDisplayedRows,
  scrollToRow,
  scrollToCell,
  fullscreen: {
    enter: fullscreenController.enterFullscreen,
    exit: fullscreenController.exitFullscreen,
    toggle: fullscreenController.toggleFullscreen,
    isActive: fullscreenController.isFullscreen,
  },
  clipboard: {
    copySelection,
    pasteText,
  },
  cellSelection: {
    clear: selection.clear,
    getRange: selection.getRange,
  },
  rowSelection: {
    getKeys: rowSelectionManager.getSelectedRowKeys,
    getRows: rowSelectionManager.getSelectedRows,
    setKeys: rowSelectionManager.setSelectedRowKeys,
    clear: rowSelectionManager.clearRowSelection,
    selectAll: rowSelectionManager.selectAllRows,
    removeSelected: removeSelectedRows,
  },
  history: {
    undo,
    redo,
    canUndo,
    canRedo,
    clear: clearHistory,
  },
  columnSetting: {
    open: openColumnSetting,
    reset: resetColumnSetting,
  },
  validation: {
    validate,
    validateRow,
    validateField,
    clear: clearValidate,
    getErrors: getValidationErrors,
    isValidating,
  },
  cellLoading: {
    start: cellLoading.startCellLoading,
    clear: cellLoading.clearCellLoading,
    isLoading: cellLoading.isCellLoading,
  },
}

defineExpose(tableExpose)
</script>

<script lang="ts">
export default {
  name: 'DataGrid',
}
</script>

<template>
  <div
    ref="containerRef"
    class="data-grid"
    :class="{
      'is-flex': isFlexibleHeight,
      'is-height-resizing': heightResize.resizing.value,
      'is-fullscreen': fullscreenController.fullscreen.value,
    }"
    :style="containerStyle"
    tabindex="-1"
    @copy.capture="onNativeCopy"
    @paste.capture="onNativePaste"
    @keydown.capture="onNativeKeyDown"
  >
    <div v-if="toolbarVisible" ref="toolbarRef" class="data-grid__toolbar">
      <div class="data-grid__toolbar-left">
        <slot name="toolbar-left" v-bind="toolbarSlotProps" />
      </div>
      <div class="data-grid__toolbar-right">
        <slot name="toolbar-right" v-bind="toolbarSlotProps" />
        <!-- DataGrid 校验中心 -->
        <DataGridValidationCenter
          v-if="validationCenterVisible"
          :validating="validationState.validating"
          :items="validationCenterItems"
          :current-error-key="currentValidationErrorKey"
          @previous="locateAdjacentValidationItem(-1)"
          @next="locateAdjacentValidationItem(1)"
          @locate="locateValidationItem"
          @clear-filters-and-locate="clearFiltersAndLocateValidationItem"
          @open-column-setting="openColumnSetting"
        />
        <el-tooltip
          v-if="rowCopyVisible"
          :content="rowCopyDisabledReason"
          :disabled="!rowCopyDisabledReason"
          placement="top"
        >
          <span class="data-grid__toolbar-action-wrap">
            <el-button size="small" :disabled="Boolean(rowCopyDisabledReason)" @click="openRowCopy">
              复制行
            </el-button>
          </span>
        </el-tooltip>
        <DataGridFormContextBoundary>
          <el-tooltip
            v-if="showFullscreenButton || fullscreenController.fullscreen.value"
            :content="fullscreenController.fullscreen.value ? '退出全屏' : '全屏显示'"
            placement="top"
          >
            <el-button
              class="data-grid__toolbar-action"
              :icon="fullscreenController.fullscreen.value ? CloseBold : FullScreen"
              circle
              text
              :aria-label="fullscreenController.fullscreen.value ? '退出表格全屏' : '表格全屏显示'"
              @click="fullscreenController.toggleFullscreen('button')"
            />
          </el-tooltip>
          <el-tooltip v-if="columnSettingEnabled" content="表格配置" placement="top">
            <el-button
              class="data-grid__toolbar-action"
              :icon="Setting"
              circle
              text
              aria-label="打开表格配置"
              @click="openColumnSetting"
            />
          </el-tooltip>
        </DataGridFormContextBoundary>
      </div>
    </div>

    <div
      class="data-grid__grid-container"
      @contextmenu.capture="onGridContextMenu"
      @pointerdown.capture="onColumnResizePointerDown"
    >
      <AgGridVue
        class="ag-theme-quartz data-grid__grid"
        theme="legacy"
        :row-data="normalizedRows"
        :column-defs="columnDefs"
        :default-col-def="defaultColDef"
        :grid-options="gridOptions"
        :get-row-id="getRowId"
        :row-selection="rowSelectionManager.agRowSelection.value"
        :selection-column-def="selectionColumnDef"
        :locale-text="DATA_GRID_ZH_CN_LOCALE"
        :row-height="rowHeight"
        :get-row-height="getTableRowHeight"
        :header-height="headerHeight"
        :pinned-bottom-row-data="pinnedBottomRowData"
        :read-only-edit="true"
        :reactive-custom-components="false"
        :animate-rows="Boolean(activeRowDragConfig)"
        :row-drag-managed="Boolean(activeRowDragConfig)"
        :suppress-move-when-row-dragging="false"
        :suppress-row-transform="hasRowMerge"
        :single-click-edit="!clipboard"
        :stop-editing-when-cells-lose-focus="false"
        :suppress-context-menu="true"
        :tooltip-show-delay="120"
        :tooltip-show-mode="gridOptions.tooltipShowMode"
        :popup-parent="popupParent"
        :post-process-popup="postProcessGridPopup"
        @grid-ready="onGridReady"
        @row-data-updated="onRowDataUpdated"
        @new-columns-loaded="onNewColumnsLoaded"
        @cell-edit-request="onCellEditRequest"
        @cell-mouse-down="selection.onCellMouseDown"
        @cell-mouse-over="selection.onCellMouseOver"
        @cell-context-menu="onCellContextMenu"
        @cell-focused="selection.onCellFocused"
        @cell-key-down="selection.onCellKeyDown"
        @body-scroll="closePopupEditor"
        @column-moved="onColumnMoved"
        @column-visible="onColumnVisible"
        @column-pinned="onColumnPinned"
        @column-resized="onColumnResized"
        @filter-changed="onFilterChanged"
        @selection-changed="rowSelectionManager.onSelectionChanged"
        @sort-changed="onSortChanged"
        @row-drag-enter="rowDrag.onRowDragEnter"
        @row-drag-end="rowDrag.onRowDragEnd"
      />
      <div v-if="loading" class="data-grid__overlay">
        <slot name="loading">
          <el-icon class="is-loading" size="24"><Loading /></el-icon>
          <span>加载中...</span>
        </slot>
      </div>
      <div v-else-if="!normalizedRows.length" class="data-grid__overlay data-grid__empty">
        <slot name="empty">暂无数据</slot>
      </div>
    </div>

    <!-- DataGrid 复杂控件共享浮层 -->
    <DataGridPopupEditorHost
      v-if="mode === 'edit' && editorDisplayMode === 'always'"
      ref="popupEditorRef"
    />

    <div
      v-if="heightResizeEnabled && !fullscreenController.fullscreen.value"
      class="data-grid__resize-handle"
      role="separator"
      aria-label="调整表格高度"
      aria-orientation="horizontal"
      :aria-valuemin="heightResize.minHeight.value"
      :aria-valuemax="heightResize.maxHeight.value"
      :aria-valuenow="heightResize.currentHeight.value"
      tabindex="0"
      @focus="heightResize.refreshBounds"
      @pointerdown="heightResize.onPointerDown"
      @keydown="heightResize.onKeyDown"
    />

    <!-- DataGrid 复制右键菜单 -->
    <DataGridContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @close="closeContextMenu"
      @copy="copyFromContextMenu(false)"
      @copy-with-headers="copyFromContextMenu(true)"
      @copy-rows="copyFromContextMenu(false, true)"
      @copy-rows-with-headers="copyFromContextMenu(true, true)"
    />

    <!-- DataGrid 复制行设置弹窗 -->
    <RowCopyDialog
      v-if="rowCopyVisible && rowCopyConfig"
      ref="rowCopyDialogRef"
      :default-count="rowCopyConfig.defaultCount"
      :min="rowCopyConfig.min"
      :max="rowCopyConfig.max"
      :default-mode="rowCopyConfig.defaultMode"
      @confirm="confirmRowCopy"
    />

    <!-- DataGrid 表格配置弹窗 -->
    <DataGridFormContextBoundary>
      <ColumnSettingDialog
        v-model="columnSettingVisible"
        :columns="columnSettingColumns"
        :min-visible-count="columnSettingMinVisibleCount"
        :show-field-name="diagnosticsEnabled"
        @save="saveColumnSetting"
        @reset="resetColumnSetting"
      />
    </DataGridFormContextBoundary>
  </div>
</template>

<style lang="scss" scoped>
.data-grid {
  /* 行选择 Radio 与 Checkbox 的统一尺寸，只接受 CSS 长度值。 */
  --data-grid-row-control-size: 16px;
  /* 行选择控件的选中及悬停主题色。 */
  --data-grid-row-control-color: var(--el-color-primary);
  /* 行选择控件未选中时的边框色。 */
  --data-grid-row-control-border-color: var(--el-border-color);
  /* 行选择控件获得键盘焦点时的外圈强调色。 */
  --data-grid-row-control-focus-color: var(--el-color-primary-light-7);

  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-height: var(--data-grid-min-height);
  outline: none;

  /*
	 * 弹性高度依赖父容器提供纵向 Flex 布局和可计算高度；
	 * 允许根节点收缩到 0，避免工具栏或表格内容把页面撑出额外滚动条。
	 */
  &.is-flex {
    flex: 1 1 0;
    min-height: 0;
  }

  /*
	 * 视口级全屏保留 body 中的 Element Plus 浮层和 DataGrid 右键菜单；
	 * 固定层只覆盖应用视口，不调用浏览器原生全屏，退出后仍由原高度配置接管布局。
	 */
  &.is-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    width: 100vw;
    height: 100dvh;
    min-height: 0;
    padding: 12px;
    background: var(--el-bg-color);
  }

  .data-grid__toolbar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    padding: 5px 8px;
    container-type: inline-size;
    //background: var(--el-fill-color-light);
    //border: 1px solid var(--el-border-color);
    //border-bottom: 0;
    //border-radius: 4px 4px 0 0;
  }

  .data-grid__toolbar-left,
  .data-grid__toolbar-right {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  .data-grid__toolbar-right {
    justify-content: flex-end;
  }

  .data-grid__toolbar-action {
    width: 28px;
    height: 28px;
    min-width: 28px;
    padding: 0;
    margin: 0;
  }

  .data-grid__toolbar-action-wrap {
    display: inline-flex;
  }

  .data-grid__grid-container {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
  }

  .data-grid__grid {
    width: 100%;
    height: 100%;
    // 将 AG Grid 主题变量映射到项目 Element Plus 设计变量。
    --ag-font-family: var(--el-font-family);
    --ag-font-size: var(--el-font-size-base);
    --ag-border-color: var(--el-border-color);
    --ag-header-background-color: var(--el-fill-color-light);
    --ag-row-hover-color: var(--el-fill-color-lighter);
    --ag-selected-row-background-color: var(--el-color-primary-light-9);
    // 复制副本使用 AG Grid 原生闪烁状态，保持短暂提示且不向业务数据写入高亮标记。
    --ag-value-change-value-highlight-background-color: var(--el-color-warning-light-7);
    // DataGrid 使用自定义选区边框，透明占位可隐藏 AG Grid 原生焦点框并避免聚焦时内容位移。
    --ag-range-selection-border-color: transparent;
  }

  /*
	 * AG Grid 默认把列宽手柄的一半放在表头外侧，固定列分区边界会覆盖这部分命中区域；
	 * 将手柄完整收进当前表头并适当加宽，保证普通列和固定列都能稳定拖拽调整宽度。
	 */
  :deep(.ag-header-cell-resize) {
    inset-inline-end: 1px;
    width: 12px;
  }

  /*
	 * 手柄覆盖在表格底部中央，不参与布局高度计算；
	 * 使用窄区域可避免遮挡 AG Grid 大部分横向滚动条。
	 */
  .data-grid__resize-handle {
    position: absolute;
    bottom: 0;
    left: 50%;
    z-index: 7;
    width: 72px;
    height: 10px;
    cursor: row-resize;
    touch-action: none;
    transform: translateX(-50%);
    outline: none;

    &::after {
      position: absolute;
      right: 12px;
      bottom: 2px;
      left: 12px;
      height: 3px;
      content: '';
      background: var(--el-border-color);
      border-radius: 2px;
      transition:
        background-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    &:hover::after,
    &:focus-visible::after {
      background: var(--el-color-primary);
      box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
    }
  }

  &.is-height-resizing {
    .data-grid__resize-handle::after {
      background: var(--el-color-primary);
      box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
    }
  }

  .data-grid__overlay {
    position: absolute;
    inset: calc(var(--data-grid-header-height) + 1px) 1px 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--el-text-color-secondary);
    background: color-mix(in srgb, var(--el-bg-color) 82%, transparent);
    z-index: 5;
  }

  .data-grid__empty {
    background: var(--el-bg-color);
  }

  /*
	 * 汇总行还包含勾选列、序号列等 AG Grid 系统列，它们不会经过业务列适配器；
	 * 直接覆盖整条固定行的单元格，确保固定区与滚动区使用同一背景色。
	 */
  :deep(.ag-row-pinned .ag-cell),
  :deep(.data-grid__summary-cell) {
    font-weight: 600;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  /*
	 * 合并锚点需要在扩展后的宽高范围内保持内容垂直居中；
	 * 背景色覆盖下层逻辑单元格，避免行边框穿过视觉合并区域。
	 */
  :deep(.data-grid__merged-cell) {
    display: flex;
    align-items: center;
    background: var(--el-bg-color);
    //border-bottom: var(--ag-borders-critical) var(--ag-border-color);
  }

  :deep(.data-grid__row-merge-cell) {
    border-bottom: var(--ag-borders-critical) var(--ag-border-color);
    border-left: var(--ag-borders-critical) var(--ag-border-color);
  }

  /*
	 * 业务列默认居中，也允许列定义分别覆盖内容和表头；
	 * 汇总行复用业务列的内容对齐类，因此无需额外维护合计对齐规则。
	 */
  :deep(.data-grid__header--align-left .ag-header-cell-label) {
    justify-content: flex-start;
    text-align: left;
  }

  :deep(.data-grid__header--align-center .ag-header-cell-label) {
    justify-content: center;
    text-align: center;
  }

  :deep(.data-grid__header--align-right .ag-header-cell-label) {
    justify-content: flex-end;
    text-align: right;
  }

  :deep(.data-grid__cell--align-left) {
    justify-content: flex-start;
    text-align: left;
  }

  :deep(.data-grid__cell--align-center) {
    justify-content: center;
    text-align: center;
  }

  :deep(.data-grid__cell--align-right) {
    justify-content: flex-end;
    text-align: right;
  }

  /*
	 * 业务单元格通过独立状态类控制纵向布局，使整表默认值和单列覆盖可以同时生效；
	 * 汇总行不包含这些状态类，系统定位列继续使用自身固定的居中规则。
	 */
  :deep(.data-grid__cell--vertical-top),
  :deep(.data-grid__cell--vertical-center),
  :deep(.data-grid__cell--vertical-bottom) {
    display: flex;

    .ag-cell-wrapper,
    .ag-cell-value {
      display: flex;
      min-width: 0;
      width: 100%;
      height: 100%;
    }
  }

  :deep(.data-grid__cell--vertical-top),
  :deep(.data-grid__cell--vertical-top .ag-cell-wrapper),
  :deep(.data-grid__cell--vertical-top .ag-cell-value) {
    align-items: flex-start;
  }

  :deep(.data-grid__cell--vertical-center),
  :deep(.data-grid__cell--vertical-center .ag-cell-wrapper),
  :deep(.data-grid__cell--vertical-center .ag-cell-value) {
    align-items: center;
  }

  :deep(.data-grid__cell--vertical-bottom),
  :deep(.data-grid__cell--vertical-bottom .ag-cell-wrapper),
  :deep(.data-grid__cell--vertical-bottom .ag-cell-value) {
    align-items: flex-end;
  }

  /* 选择列、拖拽列和序号列属于系统定位列，固定使用居中布局。 */
  :deep(.data-grid__row-selection-header .ag-header-cell-label),
  :deep(.data-grid__row-drag-header .ag-header-cell-label),
  :deep(.data-grid__row-index-header .ag-header-cell-label),
  :deep(.data-grid__row-selection-cell),
  :deep(.data-grid__row-drag-cell),
  :deep(.data-grid__row-index-cell) {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  /* AG Grid 默认给选择框和拖拽手柄预留右侧间距，系统窄列居中时需要清除。 */
  :deep(.data-grid__row-selection-header .ag-selection-checkbox),
  :deep(.data-grid__row-selection-cell .ag-selection-checkbox),
  :deep(.data-grid__row-drag-cell .ag-row-drag) {
    margin-right: 0;
  }

  /* Radio 与 Checkbox 复用 AG Grid 图标体系，并统一尺寸、主题色、焦点和禁用反馈。 */
  :deep(.data-grid-row-radio),
  :deep(.data-grid__row-selection-header .ag-checkbox-input-wrapper),
  :deep(.data-grid__row-selection-cell .ag-checkbox-input-wrapper) {
    --ag-icon-size: var(--data-grid-row-control-size);
    --ag-checkbox-checked-color: var(--data-grid-row-control-color);
    --ag-checkbox-indeterminate-color: var(--data-grid-row-control-color);
    --ag-checkbox-unchecked-color: var(--data-grid-row-control-border-color);
    --ag-input-focus-box-shadow: 0 0 0 2px var(--data-grid-row-control-focus-color);

    cursor: pointer;

    &:hover:not(.ag-disabled) {
      --ag-checkbox-unchecked-color: var(--data-grid-row-control-color);
    }

    &.ag-disabled {
      cursor: not-allowed;
    }
  }

  /* 单选列没有全选语义，隐藏 AG Grid 默认表头中保留的不可聚焦 Checkbox 容器。 */
  :deep(.data-grid__row-selection-header--single .ag-checkbox-input-wrapper) {
    visibility: hidden;
    pointer-events: none;
  }

  /* Element Plus 表单控件不继承宿主的 text-align，需要同步列内容对齐。 */
  :deep(.data-grid__cell--align-left .el-input__inner),
  :deep(.data-grid__cell--align-left .el-textarea__inner),
  :deep(.data-grid__cell--align-left .el-select__selected-item) {
    text-align: left;
  }

  :deep(.data-grid__cell--align-center .el-input__inner),
  :deep(.data-grid__cell--align-center .el-textarea__inner),
  :deep(.data-grid__cell--align-center .el-select__selected-item) {
    text-align: center;
  }

  :deep(.data-grid__cell--align-right .el-input__inner),
  :deep(.data-grid__cell--align-right .el-textarea__inner),
  :deep(.data-grid__cell--align-right .el-select__selected-item) {
    text-align: right;
  }

  :deep(.data-grid__cell--align-left .data-grid-editor-control__switch) {
    margin-right: auto;
    margin-left: 0;
  }

  :deep(.data-grid__cell--align-center .data-grid-editor-control__switch) {
    margin-right: auto;
    margin-left: auto;
  }

  :deep(.data-grid__cell--align-right .data-grid-editor-control__switch) {
    margin-right: 0;
    margin-left: auto;
  }

  /*
	 * 必填标记从列校验规则派生，避免业务页面同时维护标题文案和校验状态；
	 * 伪元素只增强视觉提示，原始表头名称仍保持可用于排序、筛选和无障碍读取。
	 */
  :deep(.data-grid__required-header .ag-header-cell-text::before) {
    margin-right: 2px;
    color: var(--el-color-danger);
    content: '*';
  }

  // 暂停表头铅笔标识，保留样式便于后续重新评估后恢复。
  // :deep(.data-grid__editable-header .ag-header-cell-text::after) {
  // 	margin-left: 5px;
  // 	font-size: 12px;
  // 	font-weight: 400;
  // 	color: var(--el-color-primary);
  // 	content: '✎';
  // 	opacity: 0.72;
  // }

  /*
	 * 可编辑提示只在悬停、聚焦和实际编辑时增强，默认仍保持紧凑表格外观；
	 * 校验错误样式位于其后，并覆盖相同状态，保证错误反馈优先。
	 */
  :deep(.data-grid__editable-cell) {
    cursor: text;
    transition:
      background-color 0.15s ease,
      box-shadow 0.15s ease;

    &:hover {
      background: var(--el-color-primary-light-9);
      box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
    }

    &.ag-cell-focus {
      background: var(--el-color-primary-light-9);
      box-shadow: 0 0 0 1px var(--el-color-primary) inset;
    }

    &.ag-cell-inline-editing {
      background: var(--el-bg-color);
      box-shadow: 0 0 0 2px var(--el-color-primary) inset;
    }
  }

  /*
	 * AG Grid 动态挂载 Renderer 时不会保留子组件的 scoped 属性，因此由 DataGrid 宿主统一控制尺寸；
	 * 常显控件在单元格内保留轻量间距，以完整展示边框、圆角和数字步进按钮；
	 * 该类只由 editorDisplayMode="always" 的可编辑列添加，不影响普通展示、插槽列和按需编辑单元格。
	 */
  :deep(.data-grid__persistent-editor-cell) {
    display: flex;
    padding: 4px 6px;
    line-height: normal;

    /*
		 * AG Grid 的 Renderer 会被包在默认宽度为内容尺寸的 wrapper 中；
		 * 必须先拉伸这两层，否则内部 el-select 的 100% 只能相对收缩后的父级计算。
		 */
    .ag-cell-wrapper,
    .ag-cell-value {
      min-width: 0;
      width: 100%;
      height: 100%;
    }

    .data-grid-persistent-editor,
    .data-grid-editor-control {
      display: flex;
      flex: 1 1 auto;
      align-items: center;
      min-width: 0;
      width: 100%;
      height: auto;
    }

    .data-grid-editor-control__input,
    .data-grid-editor-control__number,
    .data-grid-editor-control__date,
    .data-grid-editor-control__select,
    .data-grid-editor-control__custom,
    .el-input,
    .el-input-number,
    .el-select,
    .select-trigger,
    .el-date-editor {
      min-width: 0;
      width: 100%;
    }

    /*
		 * el-input-number 的右侧步进按钮按 Element Plus 默认组件高度计算；
		 * 固定为默认 32px，避免随表格行高拉伸后上下按钮之间出现断层。
		 */
    .data-grid-editor-control--number {
      align-items: center;
    }

    .data-grid-editor-control__number,
    .el-input-number {
      height: var(--el-component-size);
    }

    .el-input__wrapper {
      padding-inline: 8px;
      border-radius: var(--el-border-radius-base);
      box-shadow: 0 0 0 1px var(--el-border-color) inset;
    }

    .data-grid-persistent-editor--textarea,
    .data-grid-editor-control--textarea,
    .el-textarea,
    .el-textarea__inner {
      height: 100%;
    }

    .el-textarea__inner {
      min-height: 0 !important;
      padding: 6px 8px;
      overflow-y: auto;
      resize: none;
      border-radius: var(--el-border-radius-base);
    }

    .data-grid-editor-control__switch {
      margin: auto;
    }
  }

  /*
	 * 只对“配置了编辑器但当前不可编辑”的单元格降级，普通查看列不受影响；
	 * 动态只读仍允许选中、复制和键盘导航，因此使用默认光标；
	 * 整表禁用才使用禁止光标和次要文字色，具体原因由单元格 Tooltip 提供。
	 */
  :deep(.data-grid__readonly-cell) {
    cursor: default;
    background: var(--el-fill-color-light);
  }

  :deep(.data-grid__disabled-cell) {
    color: var(--el-text-color-secondary);
    cursor: not-allowed;
  }

  // Community 版区域选择使用单元格类名绘制，避免依赖 Enterprise Range Selection。
  :deep(.data-grid__selected-cell) {
    background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);

    /*
		 * 每个状态类只绘制矩形选区对应的一条外边，避免内部单元格重复出现网格边框；
		 * 使用真实边框可以让四条边独立组合，并保持错误态内描边不受影响。
		 */
    &.is-selection-top {
      border-top: 1px solid var(--el-color-primary) !important;
    }

    &.is-selection-right {
      border-right: 1px solid var(--el-color-primary) !important;
    }

    &.is-selection-bottom {
      border-bottom: 1px solid var(--el-color-primary) !important;
    }

    &.is-selection-left {
      border-left: 1px solid var(--el-color-primary) !important;
    }
  }

  /*
	 * 编辑、粘贴和提交共用同一错误样式；
	 * 背景与内描边组合使用，避免仅依赖颜色表达校验状态。
	 */
  :deep(.data-grid__error-cell) {
    background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
    box-shadow: 0 0 0 2px var(--el-color-danger) inset;

    &:hover,
    &.ag-cell-focus,
    &.ag-cell-inline-editing {
      background: color-mix(in srgb, var(--el-color-danger) 10%, transparent);
      box-shadow: 0 0 0 2px var(--el-color-danger) inset;
    }
  }

  /*
	 * 状态徽标脱离文档流并固定在单元格右侧，Loading 出现或消失时不改变控件外框尺寸；
	 * 浅色底将 Spinner 与输入框边框分离，同时覆盖其下方暂不可用的后缀图标。
	 */
  :deep(.data-grid__loading-cell::before),
  :deep(.data-grid__loading-cell::after) {
    position: absolute;
    inset-block-start: 50%;
    z-index: 2;
    box-sizing: border-box;
    pointer-events: none;
    content: '';
    border-radius: 50%;
  }

  :deep(.data-grid__loading-cell::before) {
    inset-inline-end: 7px;
    width: 20px;
    height: 20px;
    background: color-mix(in srgb, var(--el-bg-color-overlay) 94%, transparent);
    box-shadow: 0 1px 4px color-mix(in srgb, var(--el-text-color-primary) 14%, transparent);
    transform: translateY(-50%);
  }

  :deep(.data-grid__loading-cell::after) {
    inset-inline-end: 11px;
    width: 12px;
    height: 12px;
    border: 2px solid color-mix(in srgb, var(--el-color-primary) 28%, transparent);
    border-top-color: var(--el-color-primary);
    animation: data-grid-cell-loading-spinner 0.75s linear infinite;
  }

  :deep(.data-grid__loading-cell--validation::after) {
    border-width: 1.5px;
    opacity: 0.78;
  }

  /* 业务处理和保存任务使用轻量主题色背景；validation 仅展示弱化小圆圈，避免过度强调短暂校验。 */
  :deep(.data-grid__loading-cell--processing),
  :deep(.data-grid__loading-cell--saving) {
    background: color-mix(in srgb, var(--el-color-primary) 5%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    :deep(.data-grid__loading-cell::after) {
      animation-duration: 1.8s;
    }
  }
}

/* 仅旋转绝对定位的图标本身，不触发布局与内容重绘。 */
@keyframes data-grid-cell-loading-spinner {
  from {
    transform: translateY(-50%) rotate(0);
  }

  to {
    transform: translateY(-50%) rotate(360deg);
  }
}
</style>
