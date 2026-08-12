import { describe, expect, it } from 'vitest'
import {
  createDataGridColumnSettingItems,
  createDataGridDefaultColumnSettingStates,
  mergeDataGridColumnSettingStates,
  parseDataGridColumnSettingOverrides,
} from './columnSetting'
import type { DataGridColumn, DataGridColumnSettingOverrides, DataGridRow } from './types'

const columns: DataGridColumn<DataGridRow>[] = [
  { field: 'name', title: '名称', width: 100 },
  { field: 'quantity', title: '数量', width: 120, summary: { method: 'sum' } },
  { field: 'unit', title: '单位', width: 160 },
]

function merge(overrides: DataGridColumnSettingOverrides, currentColumns = columns) {
  return mergeDataGridColumnSettingStates(
    createDataGridDefaultColumnSettingStates(currentColumns),
    overrides,
    currentColumns,
    1,
  )
}

describe('DataGrid sparse column setting overrides', () => {
  it('enables summary for numeric columns by default and respects explicit disabling', () => {
    const states = createDataGridDefaultColumnSettingStates<DataGridRow>([
      { field: 'price', title: '单价', width: 120, searchType: 'numberRange' },
      {
        field: 'disabledAmount',
        title: '不合计金额',
        width: 120,
        searchType: 'number',
        summary: false,
      },
    ])

    expect(states.find((item) => item.field === 'price')?.summary).toBe(true)
    expect(states.find((item) => item.field === 'disabledAmount')?.summary).toBe(false)
  })

  it('keeps required columns visible even when defaults or cached overrides hide them', () => {
    const requiredColumns: DataGridColumn<DataGridRow>[] = [
      {
        field: 'name',
        title: '名称',
        initialVisible: false,
        rules: [{ required: true, message: '名称必填' }],
      },
      { field: 'unit', title: '单位', editor: { type: 'text' } },
    ]
    const defaultStates = createDataGridDefaultColumnSettingStates(requiredColumns)
    const states = mergeDataGridColumnSettingStates(
      defaultStates,
      {
        columns: [
          { field: 'name', hide: true },
          { field: 'unit', hide: true },
        ],
      },
      requiredColumns,
      1,
    )
    const items = createDataGridColumnSettingItems(states, requiredColumns)

    expect(defaultStates.find((item) => item.field === 'name')?.hide).toBe(false)
    expect(states.find((item) => item.field === 'name')?.hide).toBe(false)
    expect(items.find((item) => item.field === 'name')).toMatchObject({
      visible: true,
      hideable: false,
    })
    expect(items.find((item) => item.field === 'unit')).toMatchObject({
      visible: false,
      hideable: true,
    })
  })

  it('uses current code defaults for properties without user overrides', () => {
    const changedColumns: DataGridColumn<DataGridRow>[] = columns.map((column) =>
      column.field === 'unit' ? { ...column, width: 220, initialVisible: false } : column,
    )

    const states = merge({ columns: [] }, changedColumns)
    const unit = states.find((item) => item.field === 'unit')

    expect(unit).toMatchObject({ width: 220, hide: true })
  })

  it('keeps explicit user overrides while other properties follow changed code defaults', () => {
    const changedColumns: DataGridColumn<DataGridRow>[] = columns.map((column) =>
      column.field === 'unit'
        ? { ...column, width: 220, initialVisible: false, fixed: 'right' }
        : column,
    )

    const states = merge(
      {
        columns: [{ field: 'unit', width: 180, flex: null, hide: false }],
      },
      changedColumns,
    )
    const unit = states.find((item) => item.field === 'unit')

    expect(unit).toMatchObject({ width: 180, hide: false, fixed: 'right' })
  })

  it('uses code order until the user provides an order override and inserts new columns by code position', () => {
    const changedColumns: DataGridColumn<DataGridRow>[] = [
      columns[0],
      { field: 'specification', title: '规格', width: 140 },
      columns[1],
      columns[2],
    ]

    expect(merge({ columns: [] }, changedColumns).map((item) => item.field)).toEqual([
      'name',
      'specification',
      'quantity',
      'unit',
    ])
    expect(
      merge({ order: ['unit', 'name', 'quantity'], columns: [] }, changedColumns).map(
        (item) => item.field,
      ),
    ).toEqual(['unit', 'name', 'specification', 'quantity'])
  })

  it('parses valid sparse overrides and rejects duplicate or malformed fields', () => {
    expect(
      parseDataGridColumnSettingOverrides({
        order: ['quantity', 'name'],
        columns: [
          { field: 'quantity', hide: true },
          { field: 'name', fixed: null },
        ],
      }),
    ).toEqual({
      order: ['quantity', 'name'],
      columns: [
        { field: 'quantity', hide: true },
        { field: 'name', fixed: null },
      ],
    })
    expect(
      parseDataGridColumnSettingOverrides({ order: ['name', 'name'], columns: [] }),
    ).toBeUndefined()
    expect(
      parseDataGridColumnSettingOverrides({ columns: [{ field: 'name', width: 0 }] }),
    ).toBeUndefined()
  })
})
