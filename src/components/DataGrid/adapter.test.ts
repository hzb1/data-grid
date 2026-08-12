import { defineComponent, type Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createDataGridColumnDefs, hasDataGridRowEditableStateChanged } from './adapter'
import type { DataGridColumn, DataGridCustomEditorProps } from './types'

/** DataGrid 适配层测试使用的业务行。 */
interface TestRow extends Record<string, unknown> {
  /** 测试行唯一标识。 */
  id: number

  /** 测试名称。 */
  name: string

  /** 测试备注。 */
  remark: string

  /** 测试行当前业务状态。 */
  status?: 'draft' | 'confirmed'

  /** 测试行选中的标签值。 */
  tagCodes?: string[]

  /** 测试行是否加急。 */
  urgent?: boolean
}

describe('DataGrid column adapter', () => {
  it('marks required columns and locks them visible without adding an editable header icon', () => {
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'name',
          title: '名称',
          initialVisible: false,
          editor: { type: 'text' },
          rules: [{ required: true, message: '名称必填' }],
        },
        {
          field: 'remark',
          title: '备注',
          rules: [{ validator: () => true }],
        },
      ],
      mode: 'edit',
      editorDisplayMode: 'onDemand',
      disabled: false,
      loading: false,
      getDataIndex: (row) => row.id - 1,
      slots: {},
    })

    expect(columnDefs[0].headerClass).toEqual([
      'data-grid__header--align-center',
      'data-grid__required-header',
    ])
    expect(columnDefs[0].hide).toBe(false)
    expect(columnDefs[0].lockVisible).toBe(true)
    expect(columnDefs[1].headerClass).toBe('data-grid__header--align-center')
    expect(columnDefs[1].lockVisible).toBe(false)
  })

  it('defaults both axes to center and lets column alignment override table defaults', () => {
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [
        { field: 'name', title: '名称' },
        {
          field: 'remark',
          title: '备注',
          align: 'right',
          verticalAlign: 'bottom',
          headerAlign: 'left',
          summary: { method: 'custom', custom: () => '', className: 'business-summary--danger' },
        },
      ],
      mode: 'view',
      rowVerticalAlign: 'top',
      disabled: false,
      loading: false,
      getDataIndex: (row) => row.id - 1,
      slots: {},
    })
    const row = { id: 1, name: '物料', remark: '备注' }
    const bodyParams = { data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const summaryParams = { node: { rowIndex: null, rowPinned: 'bottom' } } as never

    expect(columnDefs[0].headerClass).toBe('data-grid__header--align-center')
    expect((columnDefs[0].cellClass as (params: never) => string[])(bodyParams)).toEqual(
      expect.arrayContaining(['data-grid__cell--align-center', 'data-grid__cell--vertical-top']),
    )
    expect(columnDefs[1].headerClass).toBe('data-grid__header--align-left')
    expect((columnDefs[1].cellClass as (params: never) => string[])(bodyParams)).toEqual(
      expect.arrayContaining(['data-grid__cell--align-right', 'data-grid__cell--vertical-bottom']),
    )
    expect((columnDefs[1].cellClass as (params: never) => string[])(summaryParams)).toEqual([
      'data-grid__cell--align-right',
      'data-grid__summary-cell',
      'business-summary--danger',
    ])
  })

  it('defaults business cells to vertical center without applying it to summary rows', () => {
    const column = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称' }],
      mode: 'view',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      slots: {},
    })[0]
    const bodyParams = {
      data: { id: 1, name: '物料', remark: '' },
      node: { rowIndex: 0, rowPinned: false },
    } as never
    const summaryParams = { node: { rowIndex: null, rowPinned: 'bottom' } } as never

    expect((column.cellClass as (params: never) => string[])(bodyParams)).toContain(
      'data-grid__cell--vertical-center',
    )
    expect((column.cellClass as (params: never) => string[])(summaryParams)).not.toContain(
      'data-grid__cell--vertical-center',
    )
  })

  it('preserves multi-line pinned summary values without applying the business cell formatter again', () => {
    const column = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'remark',
          title: '税额',
          formatter: (value) => `业务格式化：${String(value)}`,
          summary: { method: 'custom', custom: () => ['原税额：100.00', '微调后税额：99.99'] },
        },
      ],
      mode: 'view',
      disabled: false,
      loading: false,
      getDataIndex: () => -1,
      slots: {},
    })[0]
    const summaryValue = ['原税额：100.00', '微调后税额：99.99']
    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { displayValue: unknown } }
    )({
      value: summaryValue,
      data: { id: 0, name: '', remark: '' },
      node: { rowIndex: null, rowPinned: 'bottom' },
    } as never)

    expect(renderer.params.displayValue).toEqual(summaryValue)
  })

  it('distinguishes editable and dynamic readonly cells with a reason tooltip', () => {
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'name',
          title: '名称',
          editor: {
            type: 'text',
            editable: ({ row }) => row.status === 'draft',
            readonlyReason: ({ row }) =>
              row.status === 'confirmed' ? '已确认的数据不可修改' : undefined,
          },
        },
      ],
      mode: 'edit',
      editorDisplayMode: 'onDemand',
      disabled: false,
      loading: false,
      getDataIndex: (row) => row.id - 1,
      slots: {},
    })
    const column = columnDefs[0]
    const draftParams = {
      data: { id: 1, name: '草稿', remark: '', status: 'draft' },
      node: { rowIndex: 0, rowPinned: false },
    } as never
    const confirmedParams = {
      data: { id: 2, name: '已确认', remark: '', status: 'confirmed' },
      node: { rowIndex: 1, rowPinned: false },
    } as never

    expect((column.cellClass as (params: never) => string[])(draftParams)).toContain(
      'data-grid__editable-cell',
    )
    expect((column.cellClass as (params: never) => string[])(confirmedParams)).toContain(
      'data-grid__readonly-cell',
    )
    expect((column.tooltipValueGetter as (params: never) => string)(confirmedParams)).toBe(
      '已确认的数据不可修改',
    )
  })

  it('uses formatted content for custom slot tooltips and supports business getters', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '备注' }
    const columns = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'name',
          title: '名称',
          formatter: (value) => `【${String(value)}】`,
          tooltip: true,
        },
        {
          field: 'remark',
          title: '备注',
          tooltipGetter: ({ dataIndex, formattedValue }) =>
            `第 ${dataIndex + 1} 行：${formattedValue}`,
        },
      ],
      mode: 'view',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      slots: { 'cell-name': () => [] },
    })
    const nameParams = {
      data: row,
      value: row.name,
      node: { rowIndex: 0, rowPinned: false },
    } as never
    const remarkParams = {
      data: row,
      value: row.remark,
      node: { rowIndex: 0, rowPinned: false },
    } as never

    expect((columns[0].tooltipValueGetter as (params: never) => string)(nameParams)).toBe(
      '【物料】',
    )
    expect((columns[1].tooltipValueGetter as (params: never) => string)(remarkParams)).toBe(
      '第 1 行：备注',
    )
  })

  it('uses overflow tooltips by default and only shows truncated content', () => {
    const row: TestRow = { id: 1, name: '较长的物料名称', remark: '' }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称' }],
      mode: 'view',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      slots: {},
    })[0]
    const params = { data: row, value: row.name, node: { rowIndex: 0, rowPinned: false } } as never

    expect((column.tooltipValueGetter as (params: never) => string | undefined)(params)).toBe(
      row.name,
    )
  })

  it('formats readonly multi-select arrays without rendering an interactive popup trigger', () => {
    const row: TestRow = {
      id: 1,
      name: '已确认',
      remark: '',
      status: 'confirmed',
      tagCodes: ['important', 'deliveryFirst'],
    }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'tagCodes',
          title: '业务标签',
          options: [
            { label: '重点物料', value: 'important' },
            { label: '交期优先', value: 'deliveryFirst' },
          ],
          editor: {
            type: 'multiSelect',
            editable: ({ row: item }) => item.status === 'draft',
          },
        },
      ],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
    })[0]
    const params = {
      value: row.tagCodes,
      data: row,
      node: { rowIndex: 0, rowPinned: false },
    } as never

    expect((column.valueFormatter as (params: never) => string)(params)).toBe('重点物料、交期优先')
    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { displayValue: string } }
    )(params)
    expect(renderer.params.displayValue).toBe('重点物料、交期优先')
    expect((column.cellClass as (params: never) => string[])(params)).toContain(
      'data-grid__readonly-cell',
    )
    expect((column.cellClass as (params: never) => string[])(params)).not.toContain(
      'data-grid__persistent-editor-cell',
    )
  })

  it('distinguishes whole-table disabled styling from dynamic readonly styling', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '' }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: true,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
    })[0]
    const params = { value: row.name, data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const classes = (column.cellClass as (params: never) => string[])(params)

    expect(classes).toContain('data-grid__readonly-cell')
    expect(classes).toContain('data-grid__disabled-cell')
  })

  it('renders readonly boolean values as text instead of AG Grid checkboxes', () => {
    const row: TestRow = { id: 1, name: '已确认', remark: '', status: 'confirmed', urgent: true }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [
        {
          field: 'urgent',
          title: '加急',
          searchType: 'boolean',
          editor: {
            type: 'boolean',
            editable: ({ row: item }) => item.status === 'draft',
          },
        },
      ],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
    })[0]
    const trueParams = { value: true, data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const falseParams = {
      value: false,
      data: { ...row, urgent: false },
      node: { rowIndex: 0, rowPinned: false },
    } as never

    expect(column.cellDataType).toBe(false)
    expect((column.valueFormatter as (params: never) => string)(trueParams)).toBe('是')
    expect((column.valueFormatter as (params: never) => string)(falseParams)).toBe('否')
    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { displayValue: string } }
    )(trueParams)
    expect(renderer.params.displayValue).toBe('是')
  })

  it('detects both directions of a row-level dynamic editable state change', () => {
    const dynamicColumns: DataGridColumn<TestRow>[] = [
      {
        field: 'name',
        title: '名称',
        editor: {
          type: 'text' as const,
          editable: ({ row }: { row: TestRow }) => row.status === 'draft',
        },
      },
      {
        field: 'status',
        title: '状态',
        editor: { type: 'select' as const },
      },
    ]
    const draftRow: TestRow = { id: 1, name: '草稿', remark: '', status: 'draft' }
    const confirmedRow: TestRow = { ...draftRow, status: 'confirmed' }

    expect(
      hasDataGridRowEditableStateChanged<TestRow>(
        dynamicColumns,
        draftRow,
        confirmedRow,
        'edit',
        false,
        0,
        0,
      ),
    ).toBe(true)
    expect(
      hasDataGridRowEditableStateChanged<TestRow>(
        dynamicColumns,
        confirmedRow,
        draftRow,
        'edit',
        false,
        0,
        0,
      ),
    ).toBe(true)
    expect(
      hasDataGridRowEditableStateChanged<TestRow>(
        dynamicColumns,
        draftRow,
        { ...draftRow, name: '名称变化' },
        'edit',
        false,
        0,
        0,
      ),
    ).toBe(false)
  })

  it('prevents editing and hides validation errors while loading is visible', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '' }
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'onDemand',
      disabled: false,
      loading: false,
      getDataIndex: (item) => (item === row ? 0 : -1),
      slots: {},
      isCellError: () => true,
      getCellErrorMessage: () => '名称错误',
      getCellLoadingState: () => ({
        visible: true,
        type: 'validation',
        text: '校验中',
        blockInteraction: true,
      }),
      isCellInteractionBlocked: () => true,
    })
    const column = columnDefs[0]
    const params = { data: row, node: { rowIndex: 0, rowPinned: false } } as never

    expect((column.editable as (params: never) => boolean)(params)).toBe(false)
    expect((column.cellClass as (params: never) => string[])(params)).toContain(
      'data-grid__loading-cell--validation',
    )
    expect((column.cellClass as (params: never) => string[])(params)).not.toContain(
      'data-grid__error-cell',
    )
    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { dataGridTooltipText: string } }
    )(params)
    expect(renderer.params.dataGridTooltipText).toBe('校验中')
  })

  it('keeps persistent editor sizing classes during non-blocking validation', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '' }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
      getCellLoadingState: () => ({
        visible: true,
        type: 'validation',
        text: '校验中',
        blockInteraction: false,
      }),
      isCellInteractionBlocked: () => false,
    })[0]
    const params = { data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const classes = (column.cellClass as (params: never) => string[])(params)

    expect(classes).toContain('data-grid__persistent-editor-cell')
    expect(classes).toContain('data-grid__loading-cell--validation')
    expect(
      (column.cellRendererSelector as (params: never) => { component?: unknown })(params)
        ?.component,
    ).toBeDefined()
  })

  it('renders readonly content with an always-visible reason tooltip while the whole table is loading', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '' }
    const column = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: true,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
    })[0]
    const params = { data: row, node: { rowIndex: 0, rowPinned: false } } as never

    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { dataGridTooltipText: string } }
    )(params)
    expect(renderer.params.dataGridTooltipText).toBe('表格加载中，暂不可编辑')
    expect((column.cellClass as (params: never) => string[])(params)).toContain(
      'data-grid__readonly-cell',
    )
    expect((column.tooltipValueGetter as (params: never) => string)(params)).toBe(
      '表格加载中，暂不可编辑',
    )
  })

  it('renders validation errors through an always-visible tooltip', () => {
    const row: TestRow = { id: 1, name: '', remark: '' }
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'name', title: '名称', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'onDemand',
      disabled: false,
      loading: false,
      getDataIndex: (item) => (item === row ? 0 : -1),
      slots: {},
      isCellError: () => true,
      getCellErrorMessage: () => '名称必填',
    })
    const column = columnDefs[0]
    const params = { data: row, node: { rowIndex: 0, rowPinned: false } } as never

    const renderer = (
      column.cellRendererSelector as (params: never) => { params: { dataGridTooltipText: string } }
    )(params)
    expect(renderer.params.dataGridTooltipText).toBe('名称必填')
    expect((column.editable as (params: never) => boolean)(params)).toBe(true)
  })

  it('uses the persistent renderer without enabling the AG Grid editor', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '原值' }
    const updateDraft = vi.fn()
    const commitDraft = vi.fn()
    const columnDefs = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'remark', title: '备注', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      getPersistentDraftValue: (_item, _field, sourceValue) => sourceValue,
      updatePersistentDraft: updateDraft,
      commitPersistentDraft: commitDraft,
      slots: {},
    })
    const column = columnDefs[0]
    const params = { value: '原值', data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const renderer = (
      column.cellRendererSelector as (params: never) => {
        /** 常显编辑器组件。 */
        component: unknown

        /** 常显编辑器使用的事务回调。 */
        params: Record<string, (...args: unknown[]) => unknown>
      }
    )(params)

    expect(renderer.component).toBeDefined()
    expect((column.editable as (params: never) => boolean)(params)).toBe(false)
    expect((column.cellClass as (params: never) => string[])(params)).toContain(
      'data-grid__persistent-editor-cell',
    )

    renderer.params.dataGridUpdateDraft(1, 'remark', '原值', '最新值')
    renderer.params.dataGridCommitDraft(1, 'remark')

    expect(updateDraft).toHaveBeenCalledWith(row, 'remark', '原值', '最新值')
    expect(commitDraft).toHaveBeenCalledWith(1, 'remark')
  })

  it.each([
    'text',
    'textarea',
    'number',
    'date',
    'datetime',
    'select',
    'multiSelect',
    'boolean',
  ] as const)(
    'selects persistent or on-demand rendering for the %s editor from the table display mode',
    (type) => {
      const row: TestRow = { id: 1, name: '物料', remark: '原值' }
      const column = {
        field: 'remark',
        title: '备注',
        editor: { type },
      } as const
      const params = { value: '原值', data: row, node: { rowIndex: 0, rowPinned: false } } as never
      const persistentColumn = createDataGridColumnDefs<TestRow>({
        columns: [column],
        mode: 'edit',
        editorDisplayMode: 'always',
        disabled: false,
        loading: false,
        getDataIndex: () => 0,
        getRowKey: (item) => item.id,
        slots: {},
      })[0]
      const onDemandColumn = createDataGridColumnDefs<TestRow>({
        columns: [column],
        mode: 'edit',
        editorDisplayMode: 'onDemand',
        disabled: false,
        loading: false,
        getDataIndex: () => 0,
        getRowKey: (item) => item.id,
        slots: {},
      })[0]

      expect(
        (persistentColumn.cellRendererSelector as (params: never) => unknown)(params),
      ).toBeDefined()
      expect((persistentColumn.editable as (params: never) => boolean)(params)).toBe(false)
      expect(persistentColumn.cellEditor).toBeUndefined()
      expect(
        (persistentColumn.tooltipValueGetter as (params: never) => string | undefined)(params),
      ).toBeUndefined()
      expect(
        (onDemandColumn.cellRendererSelector as (params: never) => unknown)(params),
      ).toBeDefined()
      expect((onDemandColumn.editable as (params: never) => boolean)(params)).toBe(true)
      expect(onDemandColumn.cellEditor).toBeDefined()
      expect(
        (onDemandColumn.tooltipValueGetter as (params: never) => string | undefined)(params),
      ).toBe(type === 'boolean' ? '是' : '原值')
    },
  )

  it('supports a persistent custom editor and keeps slot columns on demand', () => {
    const row: TestRow = { id: 1, name: '物料', remark: '原值' }
    const CustomControl = defineComponent({ template: '<input />' }) as unknown as Component<
      DataGridCustomEditorProps<TestRow>
    >
    const params = { value: '原值', data: row, node: { rowIndex: 0, rowPinned: false } } as never
    const persistentColumn = createDataGridColumnDefs<TestRow>({
      columns: [
        { field: 'remark', title: '备注', editor: { type: 'custom', component: CustomControl } },
      ],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: {},
    })[0]
    const slotColumn = createDataGridColumnDefs<TestRow>({
      columns: [{ field: 'remark', title: '备注', editor: { type: 'text' } }],
      mode: 'edit',
      editorDisplayMode: 'always',
      disabled: false,
      loading: false,
      getDataIndex: () => 0,
      getRowKey: (item) => item.id,
      slots: { 'cell-remark': () => [] },
    })[0]

    expect(
      (persistentColumn.cellRendererSelector as (params: never) => unknown)(params),
    ).toBeDefined()
    expect((persistentColumn.editable as (params: never) => boolean)(params)).toBe(false)
    expect((slotColumn.editable as (params: never) => boolean)(params)).toBe(true)
    expect(slotColumn.cellEditor).toBeDefined()
  })
})
