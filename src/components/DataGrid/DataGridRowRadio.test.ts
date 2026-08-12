// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import type { ICellRendererParams, IRowNode } from 'ag-grid-community'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DataGridRowRadio from './DataGridRowRadio.vue'
import type { DataGridRow } from './types'

/** 单选行控件测试数据。 */
interface TestRow extends DataGridRow {
  /** 测试行唯一标识。 */
  id: number
}

function createParams(options: { selected?: boolean; selectable?: boolean } = {}) {
  let selected = options.selected ?? false
  let selectable = options.selectable ?? true
  const listeners = new Map<string, () => void>()
  const node = {
    rowIndex: 0,
    rowPinned: undefined,
    get selectable() {
      return selectable
    },
    isSelected: () => selected,
    setSelected: vi.fn((value: boolean) => {
      selected = value
      listeners.get('rowSelected')?.()
    }),
    addEventListener: vi.fn((event: string, listener: () => void) =>
      listeners.set(event, listener),
    ),
    removeEventListener: vi.fn((event: string) => listeners.delete(event)),
  } as unknown as IRowNode<TestRow>
  return {
    params: { node } as ICellRendererParams<TestRow>,
    node,
    setSelectable(value: boolean) {
      selectable = value
      listeners.get('selectableChanged')?.()
    },
  }
}

describe('DataGridRowRadio', () => {
  it('selects the current row exclusively through the Radio control', async () => {
    const { params, node } = createParams()
    const wrapper = mount(DataGridRowRadio<TestRow>, { props: { params } })

    await wrapper.get('input').trigger('change')

    expect(node.setSelected).toHaveBeenCalledWith(true, true, 'checkboxSelected')
    expect(wrapper.classes()).toContain('ag-checked')
  })

  it('keeps disabled row state synchronized with AG Grid', async () => {
    const state = createParams()
    const wrapper = mount(DataGridRowRadio<TestRow>, { props: { params: state.params } })

    state.setSelectable(false)
    await nextTick()

    expect(wrapper.classes()).toContain('ag-disabled')
    expect(wrapper.get('input').attributes('disabled')).toBeDefined()
  })
})
