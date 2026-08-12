// @vitest-environment jsdom

import { config, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('ag-grid-vue3', () => ({
  AgGridVue: defineComponent({
    name: 'AgGridVue',
    props: {
      columnDefs: Array,
      getRowId: Function,
      gridOptions: Object,
      getRowHeight: Function,
      onCellEditRequest: Function,
      pinnedBottomRowData: Array,
      popupParent: Object,
      postProcessPopup: Function,
      rowData: Array,
      rowSelection: Object,
      selectionColumnDef: Object,
      tooltipShowMode: String,
    },
    setup() {
      return () =>
        h('div', { class: 'fake-ag-grid' }, [
          h('div', { role: 'columnheader', 'col-id': 'name' }, [
            h('div', { class: 'ag-header-cell-resize' }),
          ]),
        ])
    },
  }),
}))

vi.mock('./ColumnSettingDialog.vue', async () => {
  const { defineComponent: defineMockComponent, h: renderElement } = await import('vue')
  return {
    default: defineMockComponent({
      name: 'ColumnSettingDialog',
      props: {
        showFieldName: Boolean,
      },
      setup() {
        return () => renderElement('div', { class: 'fake-column-setting' })
      },
    }),
  }
})

vi.mock('./DataGridFormContextBoundary.vue', async () => {
  const { defineComponent: defineMockComponent } = await import('vue')
  return {
    default: defineMockComponent({
      name: 'DataGridFormContextBoundary',
      setup(_props, { slots }) {
        return () => slots.default?.()
      },
    }),
  }
})

vi.mock('./message', () => ({
  dataGridMessage: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('./hooks/useDataGridColumnSetting', async () => {
  const { ref: createRef } = await import('vue')
  return {
    useDataGridColumnSetting: () => ({
      dialogVisible: createRef(false),
      dialogColumns: createRef([]),
      dialogMinVisibleCount: createRef(1),
      getInitialStates: () => [],
      initialize: vi.fn(),
      persist: vi.fn(),
      schedulePersist: vi.fn(),
      open: vi.fn(),
      save: vi.fn(),
      reset: vi.fn(),
    }),
  }
})

import DataGrid from './DataGrid.vue'
import { dataGridMessage } from './message'
import type { DataGridCustomEditorProps, DataGridExpose, DataGridRow } from './types'

/** DataGrid 集成测试读取的精简列定义。 */
interface DataGridTestColumnDef {
  /** 当前列在 AG Grid 中的唯一标识。 */
  colId?: string

  /** 当前列单元格使用的样式类。 */
  cellClass?: string

  /** 当前列表头使用的样式类。 */
  headerClass?: string

  /** 根据当前行节点计算单元格显示值。 */
  valueGetter?: (params: unknown) => unknown
}

/** DataGrid 测试调用 AG Grid 行标识函数时使用的参数。 */
interface DataGridTestRowIdParams {
  /** 当前需要解析 AG Grid 行标识的数据。 */
  data: DataGridRow
}

/** DataGrid 测试调用 AG Grid 浮层后处理函数时使用的参数。 */
interface DataGridTestPopupParams {
  /** 当前准备显示的 AG Grid 浮层节点。 */
  ePopup: HTMLElement
}

/** DataGrid 测试调用内容 Tooltip 时使用的精简参数。 */
interface DataGridTestTooltipParams {
  /** 当前单元格所属的业务行。 */
  data: DataGridRow

  /** 当前单元格的原始字段值。 */
  value: unknown

  /** 当前单元格所属的展示行节点。 */
  node: {
    /** 当前业务行在表格视图中的位置。 */
    rowIndex: number

    /** 当前行是否属于固定汇总区域。 */
    rowPinned: boolean
  }
}

/** DataGrid 测试读取的内容 Tooltip 列定义。 */
interface DataGridTooltipColumnDef {
  /** 根据当前单元格状态返回最终 Tooltip 文案。 */
  tooltipValueGetter: (params: DataGridTestTooltipParams) => string | undefined
}

/** DataGrid 常显编辑列测试读取的 Renderer 事务参数。 */
interface DataGridPersistentColumnDef {
  /** 当前列对应的业务字段。 */
  field?: string

  /** 返回当前业务行使用的常显单元格 Renderer。 */
  cellRendererSelector: (params: unknown) => {
    /** 常显编辑器使用的草稿事务回调。 */
    params: {
      /** 返回常显控件当前保存的草稿或业务原值。 */
      dataGridGetDraftValue: (rowKey: number, field: string, sourceValue: unknown) => unknown

      /** 保存常显控件的最新草稿。 */
      dataGridUpdateDraft: (
        rowKey: number,
        field: string,
        sourceValue: unknown,
        value: unknown,
      ) => void

      /** 提交常显控件的当前草稿。 */
      dataGridCommitDraft: (rowKey: number, field: string) => void
    }
  }
}

const columns = [{ field: 'name', title: '名称' }]

describe('DataGrid component integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    config.global.stubs = {
      'el-button': true,
      'el-tooltip': true,
      'el-icon': true,
      'el-popover': true,
      Loading: true,
    }
  })

  it('renders the grid shell and default empty state', () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [],
        columns,
      },
    })

    expect(wrapper.find('.fake-ag-grid').exists()).toBe(true)
    expect(wrapper.find('.data-grid__empty').text()).toBe('暂无数据')
    wrapper.unmount()
  })

  it('renders grid popups outside DataGrid with an Element Plus compatible z-index', () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [],
        columns,
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const postProcessPopup = grid.props('postProcessPopup') as (
      params: DataGridTestPopupParams,
    ) => void
    const popup = document.createElement('div')

    expect(grid.props('popupParent')).toBe(document.body)
    postProcessPopup({ ePopup: popup })
    const popupZIndex = Number(popup.style.zIndex)
    expect(popupZIndex).toBeGreaterThanOrEqual(2000)
    expect(popupZIndex).toBeLessThan(3000)
    postProcessPopup({ ePopup: popup })
    expect(Number(popup.style.zIndex)).toBe(popupZIndex)
    wrapper.unmount()
  })

  it('uses AG Grid truncated mode for default overflow tooltips', () => {
    const row = { id: 1, name: '较长的物料名称' }
    const wrapper = mount(DataGrid, {
      attachTo: document.body,
      props: {
        modelValue: [row],
        columns: [{ field: 'name', title: '名称' }],
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const column = (grid.props('columnDefs') as DataGridTooltipColumnDef[])[0]
    const tooltipParams: DataGridTestTooltipParams = {
      data: row,
      value: row.name,
      node: { rowIndex: 0, rowPinned: false },
    }
    expect(grid.props('gridOptions')).toMatchObject({ tooltipShowMode: 'whenTruncated' })
    expect(grid.props('tooltipShowMode')).toBe('whenTruncated')
    expect(column.tooltipValueGetter(tooltipParams)).toBe(row.name)
    wrapper.unmount()
  })

  it('resizes a column through pointer capture using its stable column id', async () => {
    const setColumnWidths = vi.fn()
    const column = {
      getActualWidth: () => 120,
      getColId: () => 'name',
      getPinned: () => null,
      isResizable: () => true,
    }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一' }],
        columns,
        rowKey: 'id',
      },
    })
    wrapper.findComponent({ name: 'AgGridVue' }).vm.$emit('grid-ready', {
      api: {
        getColumn: () => column,
        getColumns: () => [],
        setColumnWidths,
        stopEditing: vi.fn(),
      },
    })
    await nextTick()

    const handle = wrapper.find('.ag-header-cell-resize')
    Object.defineProperties(handle.element, {
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
      setPointerCapture: { value: vi.fn() },
    })
    const downEvent = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperties(downEvent, {
      button: { value: 0 },
      clientX: { value: 100 },
      pointerId: { value: 7 },
    })
    handle.element.dispatchEvent(downEvent)
    const moveEvent = new Event('pointermove', { cancelable: true })
    Object.defineProperties(moveEvent, { clientX: { value: 145 }, pointerId: { value: 7 } })
    window.dispatchEvent(moveEvent)
    const upEvent = new Event('pointerup', { cancelable: true })
    Object.defineProperties(upEvent, { clientX: { value: 145 }, pointerId: { value: 7 } })
    window.dispatchEvent(upEvent)

    expect(setColumnWidths).toHaveBeenNthCalledWith(
      1,
      [{ key: 'name', newWidth: 165 }],
      false,
      'uiColumnResized',
    )
    expect(setColumnWidths).toHaveBeenNthCalledWith(
      2,
      [{ key: 'name', newWidth: 165 }],
      true,
      'uiColumnResized',
    )
    wrapper.unmount()
  })

  it('uses an empty array when the controlled model is temporarily undefined', () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: undefined as unknown as DataGridRow[],
        columns,
      },
    })

    expect(wrapper.props('modelValue')).toEqual([])
    expect(wrapper.find('.data-grid__empty').text()).toBe('暂无数据')
    wrapper.unmount()
  })

  it('renders toolbar and loading slots through the public component boundary', () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一' }],
        columns,
        loading: true,
      },
      slots: {
        'toolbar-left': '<button class="refresh-action">刷新</button>',
        loading: '<span class="custom-loading">正在读取业务数据</span>',
      },
    })

    expect(wrapper.find('.data-grid__toolbar').exists()).toBe(true)
    expect(wrapper.find('.refresh-action').exists()).toBe(true)
    expect(wrapper.find('.custom-loading').text()).toBe('正在读取业务数据')
    wrapper.unmount()
  })

  it('uses safe row-operation defaults and calculates height from the current rows', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一' }],
        columns,
      },
    })

    expect(wrapper.find('.data-grid__resize-handle').exists()).toBe(true)
    expect(wrapper.find('[content="全屏显示"]').exists()).toBe(true)
    expect((wrapper.props() as { clipboard?: unknown }).clipboard).toEqual({
      copy: true,
      paste: true,
    })
    expect(wrapper.props('history')).toEqual({})
    expect(wrapper.props('rowDrag')).toBe(false)
    expect(wrapper.props('rowCopy')).toBe(false)
    expect(wrapper.props('rowVerticalAlign')).toBe('center')
    expect(wrapper.attributes('style')).toContain('height: 232px')
    const initialColumnDefs = wrapper
      .findComponent({ name: 'AgGridVue' })
      .props('columnDefs') as DataGridTestColumnDef[]
    expect(initialColumnDefs.some((column) => column.colId === '__dataGridRowIndex')).toBe(false)
    expect(initialColumnDefs.some((column) => column.colId === '__dataGridRowDrag')).toBe(false)

    await wrapper.setProps({
      modelValue: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        name: `物料${index + 1}`,
      })),
    })
    expect(wrapper.attributes('style')).toContain('height: 332px')

    await wrapper.setProps({
      heightResize: false,
      showFullscreenButton: false,
      rowNumbering: { current: 3, size: 20 },
      rowDrag: true,
      mode: 'edit',
      rowKey: 'id',
      modelValue: Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        name: `物料${index + 1}`,
      })),
    })

    expect(wrapper.find('.data-grid__resize-handle').exists()).toBe(false)
    expect(wrapper.find('[content="全屏显示"]').exists()).toBe(false)
    const columnDefs = wrapper
      .findComponent({ name: 'AgGridVue' })
      .props('columnDefs') as DataGridTestColumnDef[]
    const rowNumberingColumn = columnDefs.find((column) => column.colId === '__dataGridRowIndex')
    const rowDragColumn = columnDefs.find((column) => column.colId === '__dataGridRowDrag')
    expect(rowNumberingColumn).toBeDefined()
    expect(rowNumberingColumn?.valueGetter?.({ node: { rowIndex: 0 } })).toBe(41)
    expect(rowNumberingColumn?.cellClass).toBe('data-grid__row-index-cell')
    expect(rowNumberingColumn?.headerClass).toBe('data-grid__row-index-header')
    expect(rowDragColumn?.cellClass).toBe('data-grid__row-drag-cell')
    expect(rowDragColumn?.headerClass).toBe('data-grid__row-drag-header')
    expect(wrapper.attributes('style')).toContain('height: 1200px')
    wrapper.unmount()
  })

  it('uses the measured wrapped toolbar height only while calculating automatic height', async () => {
    let resizeCallback: ResizeObserverCallback = () => undefined
    const disconnect = vi.fn()
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      observe() {}

      unobserve() {}

      disconnect() {
        disconnect()
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          name: `物料${index + 1}`,
        })),
        columns,
      },
      slots: {
        'toolbar-left': '<button>工具栏操作</button>',
      },
    })

    await nextTick()
    const toolbar = wrapper.get('.data-grid__toolbar')
    const toolbarRect = vi
      .spyOn(toolbar.element, 'getBoundingClientRect')
      .mockReturnValue({ height: 90 } as DOMRect)
    resizeCallback([], {} as ResizeObserver)
    await nextTick()

    expect(wrapper.attributes('style')).toContain('height: 372px')

    await wrapper.setProps({ height: 400 })
    toolbarRect.mockReturnValue({ height: 130 } as DOMRect)
    resizeCallback([], {} as ResizeObserver)
    await nextTick()

    expect(wrapper.attributes('style')).toContain('height: 400px')
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('treats a non-array model value as empty data and recalculates after asynchronous rows arrive', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: null as unknown as DataGridRow[],
        columns,
      },
    })

    expect(wrapper.find('.data-grid__empty').exists()).toBe(true)
    expect(wrapper.attributes('style')).toContain('height: 232px')

    await wrapper.setProps({
      modelValue: Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        name: `异步物料${index + 1}`,
      })),
    })

    expect(wrapper.find('.data-grid__empty').exists()).toBe(false)
    expect(wrapper.attributes('style')).toContain('height: 332px')
    wrapper.unmount()
  })

  it('assigns an internal identity to the pinned summary row', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一', quantity: 2 }],
        columns: [
          { field: 'name', title: '名称' },
          { field: 'quantity', title: '数量', searchType: 'numberRange' },
        ],
        rowKey: 'id',
      },
    })

    await wrapper.setProps({ summary: { label: '合计', scope: 'all' } })
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const pinnedRows = grid.props('pinnedBottomRowData') as DataGridRow[]
    const getRowId = grid.props('getRowId') as (params: DataGridTestRowIdParams) => string

    expect(pinnedRows).toHaveLength(1)
    expect(pinnedRows[0].quantity).toBe('2')
    expect(getRowId({ data: pinnedRows[0] })).toMatch(/^string:data-grid:internal:/)
    wrapper.unmount()
  })

  it('expands the pinned summary row to fit multi-line values', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一', quantity: 2 }],
        columns: [
          { field: 'name', title: '名称' },
          {
            field: 'quantity',
            title: '数量',
            searchType: 'numberRange',
            formatter: (value) => `格式化：${String(value)}`,
            summary: { method: 'custom', custom: () => ['原数量：5', '本次数量：2'] },
          },
        ],
        rowHeight: 44,
      },
    })
    await wrapper.setProps({ summary: true })
    await nextTick()
    await nextTick()

    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const getRowHeight = grid.props('getRowHeight') as (params: {
      node: { rowPinned?: string }
    }) => number
    expect((grid.props('pinnedBottomRowData') as DataGridRow[])[0].quantity).toEqual([
      '原数量：5',
      '本次数量：2',
    ])
    expect(getRowHeight({ node: {} })).toBe(44)
    expect(getRowHeight({ node: { rowPinned: 'bottom' } })).toBe(52)
    wrapper.unmount()
  })

  it('processes copied rows before assigning private row identities and committing history data', async () => {
    const sourceRow = { id: 1, name: '原物料' }
    const processInsertedRows = vi.fn((rows: DataGridRow[]) =>
      rows.map((row) => {
        const newRow = { ...row }
        delete newRow.id
        return newRow
      }),
    )
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [sourceRow],
        columns,
        mode: 'edit',
        rowKey: 'id',
        selectedRowKeys: [1],
        rowSelection: { mode: 'single' },
        rowCopy: { processInsertedRows },
      },
      global: {
        stubs: {
          'el-tooltip': defineComponent({
            setup(_props, { slots }) {
              return () => h('div', slots.default?.())
            },
          }),
          RowCopyDialog: defineComponent({
            name: 'RowCopyDialog',
            emits: ['confirm'],
            setup(_props, { expose }) {
              expose({ open: vi.fn(), close: vi.fn() })
              return () => h('div')
            },
          }),
        },
      },
    })
    wrapper.findComponent({ name: 'AgGridVue' }).vm.$emit('grid-ready', {
      api: {
        getColumns: () => [],
        getRowNode: () => undefined,
        refreshCells: vi.fn(),
        stopEditing: vi.fn(),
        forEachNode: (
          callback: (node: {
            data: DataGridRow
            rowPinned: boolean
            setSelected: ReturnType<typeof vi.fn>
          }) => void,
        ) => callback({ data: sourceRow, rowPinned: false, setSelected: vi.fn() }),
      },
    })
    await nextTick()
    const copyButton = wrapper.find('.data-grid__toolbar-action-wrap el-button-stub')
    expect(copyButton.exists()).toBe(true)
    await copyButton.trigger('click')
    await nextTick()
    wrapper
      .findComponent({ name: 'RowCopyDialog' })
      .vm.$emit('confirm', { count: 2, mode: 'insert' })
    await nextTick()

    const rows = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as DataGridRow[]
    const copyChange = wrapper.emitted('row-copy')?.at(-1)?.[0] as { insertedRows: DataGridRow[] }
    const getRowId = wrapper.findComponent({ name: 'AgGridVue' }).props('getRowId') as (
      params: DataGridTestRowIdParams,
    ) => string
    expect(processInsertedRows).toHaveBeenCalledOnce()
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(sourceRow)
    expect(copyChange.insertedRows).toEqual(rows.slice(1))
    expect(copyChange.insertedRows.every((row) => row.id === undefined)).toBe(true)
    expect(new Set(copyChange.insertedRows).size).toBe(2)
    expect(copyChange.insertedRows.map((row) => getRowId({ data: row }))).toEqual([
      expect.stringMatching(/^string:data-grid:internal:/),
      expect.stringMatching(/^string:data-grid:internal:/),
    ])
    wrapper.unmount()
  })

  it('keeps the source business rowKey stable when a copied row retains the same id', async () => {
    const sourceRow = { id: 1, name: '原物料' }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [sourceRow],
        columns,
        mode: 'edit',
        rowKey: 'id',
        selectedRowKeys: [1],
        rowSelection: { mode: 'single' },
        rowCopy: true,
      },
      global: {
        stubs: {
          'el-tooltip': defineComponent({
            setup(_props, { slots }) {
              return () => h('div', slots.default?.())
            },
          }),
          RowCopyDialog: defineComponent({
            name: 'RowCopyDialog',
            emits: ['confirm'],
            setup(_props, { expose }) {
              expose({ open: vi.fn(), close: vi.fn() })
              return () => h('div')
            },
          }),
        },
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    grid.vm.$emit('grid-ready', {
      api: {
        getColumns: () => [],
        getRowNode: () => undefined,
        refreshCells: vi.fn(),
        stopEditing: vi.fn(),
        forEachNode: (
          callback: (node: {
            data: DataGridRow
            rowPinned: boolean
            setSelected: ReturnType<typeof vi.fn>
          }) => void,
        ) => callback({ data: sourceRow, rowPinned: false, setSelected: vi.fn() }),
      },
    })
    await nextTick()

    const getRowId = grid.props('getRowId') as (params: DataGridTestRowIdParams) => string
    expect(getRowId({ data: sourceRow })).toBe('number:1')
    await wrapper.find('.data-grid__toolbar-action-wrap el-button-stub').trigger('click')
    await nextTick()
    wrapper
      .findComponent({ name: 'RowCopyDialog' })
      .vm.$emit('confirm', { count: 1, mode: 'insert' })
    await nextTick()

    const rows = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as DataGridRow[]
    await wrapper.setProps({ modelValue: rows })
    await nextTick()

    expect(rows).toHaveLength(2)
    expect(rows[0]).toStrictEqual(sourceRow)
    expect(rows[1].id).toBe(1)
    expect(getRowId({ data: sourceRow })).toBe('number:1')
    expect(getRowId({ data: rows[1] })).toMatch(/^string:data-grid:internal:/)
    wrapper.unmount()
  })

  it('recalculates the filtered summary after AG Grid receives asynchronous row data', async () => {
    const row = { id: 1, name: '异步物料', quantity: 2 }
    let displayedRows: DataGridRow[] = []
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [
          { field: 'name', title: '名称' },
          { field: 'quantity', title: '数量', searchType: 'numberRange' },
        ],
        rowKey: 'id',
        summary: true,
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    grid.vm.$emit('grid-ready', {
      api: {
        getColumns: () => [],
        forEachNodeAfterFilterAndSort: (
          callback: (node: { data: DataGridRow; rowPinned: boolean }) => void,
        ) => {
          displayedRows.forEach((currentRow) => callback({ data: currentRow, rowPinned: false }))
        },
      },
    })
    await nextTick()
    expect((grid.props('pinnedBottomRowData') as DataGridRow[])[0].quantity).toBe('')

    displayedRows = [row]
    grid.vm.$emit('row-data-updated')
    await nextTick()

    expect((grid.props('pinnedBottomRowData') as DataGridRow[])[0].quantity).toBe('2')
    wrapper.unmount()
  })

  it('keeps the pinned summary row reference when repeated updates produce the same result', async () => {
    const row = { id: 1, name: '物料一', quantity: 2 }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [
          { field: 'name', title: '名称' },
          { field: 'quantity', title: '数量', searchType: 'numberRange' },
        ],
        rowKey: 'id',
        summary: true,
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    grid.vm.$emit('grid-ready', {
      api: {
        getColumns: () => [],
        forEachNodeAfterFilterAndSort: (
          callback: (node: { data: DataGridRow; rowPinned: boolean }) => void,
        ) => callback({ data: row, rowPinned: false }),
      },
    })
    await nextTick()
    const firstSummaryRow = (grid.props('pinnedBottomRowData') as DataGridRow[])[0]

    grid.vm.$emit('row-data-updated')
    await nextTick()

    expect((grid.props('pinnedBottomRowData') as DataGridRow[])[0]).toBe(firstSummaryRow)
    wrapper.unmount()
  })

  it('only passes the column field name to the setting dialog in diagnostic mode', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [],
        columns,
        diagnostics: false,
      },
    })
    const dialog = wrapper.findComponent({ name: 'ColumnSettingDialog' })

    expect(dialog.props('showFieldName')).toBe(false)
    await wrapper.setProps({ diagnostics: true })
    expect(dialog.props('showFieldName')).toBe(true)
    wrapper.unmount()
  })

  it('allows controlled selection to use the component-private rowKey', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ name: '临时物料' }],
        columns,
        selectedRowKeys: [],
        rowSelection: { mode: 'multiple' },
        diagnostics: true,
      },
    })
    await nextTick()
    const emittedDiagnostics = (wrapper.emitted('diagnostic') ?? []).map(
      (args) => args[0] as { code: string; level: string },
    )
    const selectionColumnDef = wrapper
      .findComponent({ name: 'AgGridVue' })
      .props('selectionColumnDef') as {
      /** 选择列单元格样式类。 */
      cellClass?: string

      /** 选择列表头样式类。 */
      headerClass?: string
    }

    expect(emittedDiagnostics.some((item) => item.code.startsWith('DG-ROW-'))).toBe(false)
    expect(selectionColumnDef.cellClass).toBe(
      'data-grid__row-selection-cell data-grid__row-selection-cell--multiple',
    )
    expect(selectionColumnDef.headerClass).toBe(
      'data-grid__row-selection-header data-grid__row-selection-header--multiple',
    )
    wrapper.unmount()
  })

  it('uses an explicit Radio column for single row selection', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料' }],
        columns,
        rowKey: 'id',
        rowSelection: { mode: 'single' },
      },
    })
    await nextTick()
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const rowSelection = grid.props('rowSelection') as {
      /** 是否展示 AG Grid 原生 Checkbox。 */
      checkboxes?: boolean
    }
    const columnDefs = grid.props('columnDefs') as Array<{
      /** 当前列的内部标识。 */
      colId?: string

      /** 当前列使用的单元格渲染组件。 */
      cellRenderer?: Component
    }>
    const radioColumn = columnDefs.find((column) => column.colId === '__dataGridRowRadio')

    expect(rowSelection.checkboxes).toBe(false)
    expect(radioColumn?.cellRenderer).toBeDefined()
    wrapper.unmount()
  })

  it('copies a selected cell from a new row without a business rowKey after DOM focus is lost', async () => {
    const row = { name: '临时物料' }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns,
        rowKey: 'id',
      },
    })
    const agColumn = { getColId: () => 'name' }
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    grid.vm.$emit('grid-ready', {
      api: {
        getAllDisplayedColumns: () => [agColumn],
        getColumn: () => agColumn,
        getColumns: () => [agColumn],
        getDisplayedRowAtIndex: (displayIndex: number) =>
          displayIndex === 0 ? { data: row } : undefined,
        refreshCells: vi.fn(),
      },
    })
    grid.vm.$emit('cell-mouse-down', {
      rowIndex: 0,
      rowPinned: false,
      column: agColumn,
      event: new MouseEvent('mousedown', { button: 0 }),
    })
    await nextTick()

    const setData = vi.fn()
    const copyEvent = new Event('copy', { bubbles: true, cancelable: true })
    Object.defineProperty(copyEvent, 'clipboardData', { value: { setData } })
    document.body.dispatchEvent(copyEvent)

    expect(copyEvent.defaultPrevented).toBe(true)
    expect(setData).toHaveBeenCalledWith('text/plain', '临时物料')
    expect(dataGridMessage.success).toHaveBeenCalledWith('已复制到剪贴板')
    wrapper.unmount()
  })

  it('appends pasted rows with private identities when the configured business rowKey is missing', async () => {
    const row = { name: '临时物料' }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns,
        mode: 'edit',
        rowKey: 'id',
      },
    })
    const agColumn = { getColId: () => 'name' }
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    grid.vm.$emit('grid-ready', {
      api: {
        stopEditing: vi.fn(),
        getAllDisplayedColumns: () => [agColumn],
        getColumn: () => agColumn,
        getColumns: () => [agColumn],
        getDisplayedRowCount: () => 1,
        getDisplayedRowAtIndex: (displayIndex: number) =>
          displayIndex === 0 ? { data: row } : undefined,
        refreshCells: vi.fn(),
      },
    })
    grid.vm.$emit('cell-mouse-down', {
      rowIndex: 0,
      rowPinned: false,
      column: agColumn,
      event: new MouseEvent('mousedown', { button: 0 }),
    })
    await nextTick()
    const table = wrapper.vm.$.exposed as unknown as DataGridExpose<DataGridRow>

    await expect(table.clipboard.pasteText('修改物料\n追加物料')).resolves.toBe(true)
    const rows = wrapper.emitted('update:modelValue')?.at(-1)?.[0] as DataGridRow[]
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatchObject({ name: '追加物料' })
    expect(rows[1].id).toBeUndefined()
    expect(dataGridMessage.error).not.toHaveBeenCalledWith(
      expect.stringContaining('rowKey 无效或重复'),
    )
    wrapper.unmount()
  })

  it('requires a stable rowKey when selection is reserved across data changes', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ name: '临时物料' }],
        columns,
        rowSelection: { mode: 'multiple', reserveSelection: true },
        diagnostics: true,
      },
    })
    await nextTick()
    const emittedDiagnostics = (wrapper.emitted('diagnostic') ?? []).map(
      (args) => args[0] as { code: string; level: string },
    )

    expect(emittedDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'DG-ROW-007', level: 'error' }),
    )
    expect(emittedDiagnostics).toContainEqual(
      expect.objectContaining({ code: 'DG-ROW-004', level: 'error' }),
    )
    wrapper.unmount()
  })

  it('exposes grouped feature APIs and no legacy flat feature methods', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [],
        columns,
        mode: 'edit',
        rowKey: 'id',
        clipboard: { copy: true, paste: true },
      },
    })
    const table = wrapper.vm.$.exposed as unknown as DataGridExpose<DataGridRow>

    expect(table.getDisplayedRows()).toEqual([])
    expect(Object.keys(table.fullscreen)).toEqual(['enter', 'exit', 'toggle', 'isActive'])
    expect(Object.keys(table.clipboard)).toEqual(['copySelection', 'pasteText'])
    expect(Object.keys(table.cellSelection)).toEqual(['clear', 'getRange'])
    expect(Object.keys(table.rowSelection)).toEqual([
      'getKeys',
      'getRows',
      'setKeys',
      'clear',
      'selectAll',
      'removeSelected',
    ])
    expect(Object.keys(table.history)).toEqual(['undo', 'redo', 'canUndo', 'canRedo', 'clear'])
    expect(Object.keys(table.columnSetting)).toEqual(['open', 'reset'])
    expect(Object.keys(table.validation)).toEqual([
      'validate',
      'validateRow',
      'validateField',
      'clear',
      'getErrors',
      'isValidating',
    ])
    expect(Object.keys(table.cellLoading)).toEqual(['start', 'clear', 'isLoading'])
    expect('undo' in table).toBe(false)
    expect('pasteText' in table).toBe(false)
    expect('validate' in table).toBe(false)
    await expect(table.clipboard.pasteText('物料一')).resolves.toBe(false)
    wrapper.unmount()
  })

  it('keeps remove history when the parent clones controlled rows and clears it for a conflicting external update', async () => {
    const rows = [
      { id: 1, name: '物料一', metadata: { unit: '吨' } },
      { id: 2, name: '物料二', metadata: { unit: '吨' } },
      { id: 3, name: '物料三', metadata: { unit: '吨' } },
    ]
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: rows,
        columns,
        mode: 'edit',
        rowKey: 'id',
        rowSelection: { mode: 'multiple' },
        history: { limit: 10 },
      },
    })
    const table = wrapper.vm.$.exposed as unknown as DataGridExpose<(typeof rows)[number]>

    table.rowSelection.setKeys([1, 3])
    expect(table.rowSelection.removeSelected()).toEqual([rows[0], rows[2]])
    const rowsAfterRemove = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as (typeof rows)[number][]
    expect(rowsAfterRemove).toEqual([rows[1]])
    expect(wrapper.emitted('data-change')?.at(-1)?.[0]).toMatchObject({
      source: 'remove',
      rows: [rows[1]],
      removedRows: [rows[0], rows[2]],
    })
    expect(table.rowSelection.getKeys()).toEqual([])
    expect(table.history.canUndo()).toBe(true)

    await wrapper.setProps({
      modelValue: rowsAfterRemove.map((row) => ({ ...row, metadata: { ...row.metadata } })),
    })
    expect(table.history.canUndo()).toBe(true)
    expect(table.history.undo()).toBe(true)
    const rowsAfterUndo = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as (typeof rows)[number][]
    expect(rowsAfterUndo).toEqual(rows)

    await wrapper.setProps({
      modelValue: rowsAfterUndo.map((row) => ({ ...row, metadata: { ...row.metadata } })),
    })
    expect(table.history.redo()).toBe(true)
    const rowsAfterRedo = wrapper
      .emitted('update:modelValue')
      ?.at(-1)?.[0] as (typeof rows)[number][]
    expect(rowsAfterRedo).toEqual([rows[1]])

    await wrapper.setProps({ modelValue: [{ ...rowsAfterRedo[0], name: '外部替换后的物料' }] })
    expect(table.history.canUndo()).toBe(false)
    wrapper.unmount()
  })

  it('does not remove rows when selection is empty or the table is not editable', async () => {
    const rows = [{ id: 1, name: '物料一' }]
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: rows,
        columns,
        mode: 'view',
        rowKey: 'id',
        rowSelection: { mode: 'multiple' },
      },
    })
    const table = wrapper.vm.$.exposed as unknown as DataGridExpose<(typeof rows)[number]>

    table.rowSelection.setKeys([1])
    expect(table.rowSelection.removeSelected()).toEqual([])
    await wrapper.setProps({ mode: 'edit' })
    table.rowSelection.clear()
    expect(table.rowSelection.removeSelected()).toEqual([])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows and hides the toolbar with the validation center state', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '' }],
        columns: [
          { field: 'name', title: '名称', rules: [{ required: true, message: '名称不能为空' }] },
        ],
        rowKey: 'id',
        showFullscreenButton: false,
      },
    })
    const table = (wrapper.vm.$.exposed as unknown as DataGridExpose).validation

    expect(wrapper.find('.data-grid__toolbar').exists()).toBe(false)
    await expect(table.validate({ scrollToFirstError: false })).resolves.toMatchObject({
      valid: false,
    })
    await nextTick()
    expect(wrapper.find('.data-grid__toolbar').exists()).toBe(true)
    expect(wrapper.find('.data-grid-validation-center').text()).toContain('1 个校验错误')

    table.clear()
    await nextTick()
    expect(wrapper.find('.data-grid__toolbar').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the validation center out of the toolbar when validation.center is false', async () => {
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '' }],
        columns: [{ field: 'name', title: '名称', rules: [{ required: true }] }],
        rowKey: 'id',
        showFullscreenButton: false,
        validation: { center: false },
      },
    })
    const table = (wrapper.vm.$.exposed as unknown as DataGridExpose).validation

    await table.validate({ scrollToFirstError: false })
    await nextTick()
    expect(wrapper.find('.data-grid__toolbar').exists()).toBe(false)
    expect(wrapper.find('.data-grid-validation-center').exists()).toBe(false)
    wrapper.unmount()
  })

  it('validates only fields changed by an edit transaction while retaining row rules', async () => {
    const materialCodeValidator = vi.fn(() => Promise.resolve(true as const))
    const quantityValidator = vi.fn(() => true as const)
    const rowValidator = vi.fn(() => true as const)
    const row = { id: 1, materialCode: 'WL0001', quantity: 1 }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [
          {
            field: 'materialCode',
            title: '物料编码',
            editor: { type: 'text' },
            rules: [{ validator: materialCodeValidator }],
          },
          {
            field: 'quantity',
            title: '数量',
            editor: { type: 'number' },
            rules: [{ validator: quantityValidator }],
          },
        ],
        rowRules: [{ validator: rowValidator }],
        mode: 'edit',
        rowKey: 'id',
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const onCellEditRequest = grid.props('onCellEditRequest') as (event: {
      /** 编辑前的业务行。 */
      data: typeof row

      /** 当前编辑列。 */
      colDef: { field: string }

      /** 编辑器提交的新值。 */
      newValue: number
    }) => void

    onCellEditRequest({ data: row, colDef: { field: 'quantity' }, newValue: 2 })
    await nextTick()
    await Promise.resolve()

    expect(quantityValidator).toHaveBeenCalledOnce()
    expect(materialCodeValidator).not.toHaveBeenCalled()
    expect(rowValidator).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('keeps the same private row identity across immutable edits without writing to business data', async () => {
    const row = { name: '临时物料' }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
        mode: 'edit',
        diagnostics: false,
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const columnDefs = grid.props('columnDefs') as Array<{
      /** 当前列对应的业务字段。 */
      field?: string

      /** 返回当前行使用的常显编辑器参数。 */
      cellRendererSelector: (params: unknown) => {
        /** 常显编辑器需要的行身份和事务回调。 */
        params: {
          /** 当前行在组件实例内使用的私有身份。 */
          dataGridRowKey: string | number

          /** 保存常显控件的最新草稿。 */
          dataGridUpdateDraft: (
            rowKey: string | number,
            field: string,
            sourceValue: unknown,
            value: unknown,
          ) => void

          /** 提交常显控件的当前草稿。 */
          dataGridCommitDraft: (rowKey: string | number, field: string) => void
        }
      }
    }>
    const businessColumn = columnDefs.find((column) => column.field === 'name')!
    const firstRenderer = businessColumn.cellRendererSelector({
      value: row.name,
      data: row,
      node: { rowIndex: 0, rowPinned: false },
    })
    const privateRowKey = firstRenderer.params.dataGridRowKey

    firstRenderer.params.dataGridUpdateDraft(privateRowKey, 'name', row.name, '临时物料一')
    firstRenderer.params.dataGridCommitDraft(privateRowKey, 'name')
    await nextTick()
    const firstChange = wrapper.emitted('data-change')?.at(-1)?.[0] as {
      /** 事务后的完整业务行。 */
      rows: Array<{ name: string }>

      /** 事务产生的字段变化。 */
      changes: Array<{ rowKey: string | number }>
    }

    expect(privateRowKey).toMatch(/^data-grid:internal:/)
    expect(firstChange.changes[0].rowKey).toBe(privateRowKey)
    expect(firstChange.rows[0]).not.toHaveProperty('__dataGridRowKey')

    await wrapper.setProps({ modelValue: firstChange.rows })
    const secondRenderer = businessColumn.cellRendererSelector({
      value: firstChange.rows[0].name,
      data: firstChange.rows[0],
      node: { rowIndex: 0, rowPinned: false },
    })
    secondRenderer.params.dataGridUpdateDraft(
      privateRowKey,
      'name',
      firstChange.rows[0].name,
      '临时物料二',
    )
    secondRenderer.params.dataGridCommitDraft(privateRowKey, 'name')
    await nextTick()
    const secondChange = wrapper.emitted('data-change')?.at(-1)?.[0] as {
      /** 事务产生的字段变化。 */
      changes: Array<{ rowKey: string | number }>
    }

    expect(secondChange.changes[0].rowKey).toBe(privateRowKey)
    wrapper.unmount()
  })

  it('commits empty persistent text drafts without allowing a stale renderer refresh to restore the old value', async () => {
    const row = { id: 1, remark: '原值', version: 0 }
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [{ field: 'remark', title: '备注', editor: { type: 'text' } }],
        mode: 'edit',
        rowKey: 'id',
        processRowChange: (candidate: DataGridRow) => ({
          ...candidate,
          version: Number(candidate.version) + 1,
        }),
      },
    })
    const grid = wrapper.findComponent({ name: 'AgGridVue' })
    const columnDefs = grid.props('columnDefs') as Array<{
      /** 当前列对应的业务字段。 */
      field?: string

      /** 返回当前行使用的单元格 Renderer。 */
      cellRendererSelector: (params: unknown) => {
        /** 常显编辑器的回调参数。 */
        params: {
          /** 返回常显控件当前保存的草稿或业务原值。 */
          dataGridGetDraftValue: (rowKey: number, field: string, sourceValue: unknown) => unknown

          /** 保存常显输入草稿。 */
          dataGridUpdateDraft: (
            rowKey: number,
            field: string,
            sourceValue: unknown,
            value: unknown,
          ) => void

          /** 提交常显输入草稿。 */
          dataGridCommitDraft: (rowKey: number, field: string) => void
        }
      }
    }>
    const businessColumn = columnDefs.find((column) => column.field === 'remark')!
    const renderer = businessColumn.cellRendererSelector({
      value: '原值',
      data: row,
      node: { rowIndex: 0, rowPinned: false },
    })

    renderer.params.dataGridUpdateDraft(1, 'remark', '原值', '')
    renderer.params.dataGridCommitDraft(1, 'remark')

    expect(renderer.params.dataGridGetDraftValue(1, 'remark', '原值')).toBe('')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      {
        id: 1,
        remark: '',
        version: 1,
      },
    ])
    expect(wrapper.emitted('cell-change')?.at(-1)?.[0]).toMatchObject({
      field: 'remark',
      oldValue: '原值',
      newValue: '',
    })
    wrapper.unmount()
  })

  it('retains a persistent draft when the row transaction fails and allows a later retry', async () => {
    const row = { id: 1, remark: '原值' }
    const processRowChange = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('暂时无法提交')
      })
      .mockImplementation((candidate) => candidate)
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [{ field: 'remark', title: '备注', editor: { type: 'text' } }],
        mode: 'edit',
        rowKey: 'id',
        processRowChange,
      },
    })
    const column = (
      wrapper
        .findComponent({ name: 'AgGridVue' })
        .props('columnDefs') as DataGridPersistentColumnDef[]
    ).find((item) => item.field === 'remark')!
    const renderer = column.cellRendererSelector({
      value: '原值',
      data: row,
      node: { rowIndex: 0, rowPinned: false },
    })

    renderer.params.dataGridUpdateDraft(1, 'remark', '原值', '可重试草稿')
    renderer.params.dataGridCommitDraft(1, 'remark')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    renderer.params.dataGridCommitDraft(1, 'remark')
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      { id: 1, remark: '可重试草稿' },
    ])
    wrapper.unmount()
  })

  it('flushes an unconfirmed persistent custom draft before whole-table validation', async () => {
    const row = { id: 1, customValue: '原值' }
    const CustomControl = defineComponent({ template: '<input />' }) as unknown as Component<
      DataGridCustomEditorProps<DataGridRow>
    >
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [row],
        columns: [
          {
            field: 'customValue',
            title: '自定义值',
            editor: { type: 'custom', component: CustomControl },
          },
        ],
        mode: 'edit',
        rowKey: 'id',
      },
    })
    const column = (
      wrapper
        .findComponent({ name: 'AgGridVue' })
        .props('columnDefs') as DataGridPersistentColumnDef[]
    ).find((item) => item.field === 'customValue')!
    const renderer = column.cellRendererSelector({
      value: '原值',
      data: row,
      node: { rowIndex: 0, rowPinned: false },
    })

    renderer.params.dataGridUpdateDraft(1, 'customValue', '原值', '待校验草稿')
    await (wrapper.vm.$.exposed as unknown as DataGridExpose).validation.validate()

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      { id: 1, customValue: '待校验草稿' },
    ])
    wrapper.unmount()
  })

  it('cleans cell loading tasks on data, column and rowKey replacement and unmount', async () => {
    vi.useFakeTimers()
    const wrapper = mount(DataGrid, {
      props: {
        modelValue: [{ id: 1, name: '物料一' }],
        columns,
        rowKey: 'id',
      },
    })
    const table = (wrapper.vm.$.exposed as unknown as DataGridExpose).cellLoading

    table.start(1, 'name')
    await wrapper.setProps({ modelValue: [{ id: 1, name: '替换后的物料' }] })
    expect(table.isLoading(1, 'name')).toBe(false)

    table.start(1, 'name')
    await wrapper.setProps({ columns: [{ field: 'remark', title: '备注' }] })
    expect(table.isLoading(1, 'name')).toBe(false)

    table.start(1, 'remark')
    await wrapper.setProps({ rowKey: 'name' })
    expect(table.isLoading(1, 'remark')).toBe(false)

    table.start(1, 'remark')
    wrapper.unmount()
    expect(table.isLoading(1, 'remark')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    vi.useRealTimers()
  })
})
