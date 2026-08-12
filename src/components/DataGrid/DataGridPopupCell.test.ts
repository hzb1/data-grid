// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataGridMultiSelectCell from './DataGridMultiSelectCell.vue'
import DataGridTextareaCell from './DataGridTextareaCell.vue'

describe('DataGrid popup cell triggers', () => {
  it('shows a textarea summary and requests opening the shared popup', async () => {
    const wrapper = mount(DataGridTextareaCell, {
      props: {
        value: '第一行\n第二行',
      },
      global: {
        stubs: {
          'el-icon': true,
        },
      },
    })

    expect(wrapper.text()).toContain('第一行')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('maps multi-select values to a compact label summary', async () => {
    const wrapper = mount(DataGridMultiSelectCell, {
      props: {
        value: ['important', 'deliveryFirst'],
        column: {
          field: 'tagCodes',
          title: '业务标签',
          options: [
            { label: '重点物料', value: 'important' },
            { label: '交期优先', value: 'deliveryFirst' },
          ],
        },
      },
      global: {
        stubs: {
          'el-icon': true,
        },
      },
    })

    expect(wrapper.text()).toContain('重点物料')
    expect(wrapper.text()).toContain('+1')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })
})
