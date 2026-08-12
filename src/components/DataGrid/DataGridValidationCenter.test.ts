// @vitest-environment jsdom

import { config, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import DataGridValidationCenter from './DataGridValidationCenter.vue'

const visibleItem = {
  key: 'visible',
  error: {
    rowKey: 1,
    dataIndex: 0,
    field: 'name',
    columnTitle: '名称',
    value: '',
    message: '名称不能为空',
    row: { id: 1, name: '' },
    trigger: 'submit' as const,
    source: 'column' as const,
  },
  status: 'visible' as const,
  displayIndex: 0,
  columnSettingEnabled: true,
}

const secondVisibleItem = {
  ...visibleItem,
  key: 'second-visible',
  error: {
    ...visibleItem.error,
    rowKey: 2,
    dataIndex: 1,
    message: '名称长度不足',
    row: { id: 2, name: 'A' },
  },
  displayIndex: 1,
}

const filteredItem = {
  ...visibleItem,
  key: 'filtered',
  error: {
    ...visibleItem.error,
    rowKey: 3,
    dataIndex: 2,
    message: '筛选行错误',
    row: { id: 3, name: '' },
  },
  status: 'filtered' as const,
  displayIndex: -1,
}

const hiddenColumnItem = {
  ...visibleItem,
  key: 'hidden-column',
  error: {
    ...visibleItem.error,
    field: 'code',
    columnTitle: '编码',
    message: '编码不能为空',
  },
  status: 'hidden-column' as const,
  displayIndex: -1,
}

describe('DataGridValidationCenter', () => {
  beforeEach(() => {
    config.global.stubs = {
      'el-button': true,
      'el-icon': true,
      'el-tooltip': defineComponent({
        setup(_, { slots }) {
          return () => h('div', { class: 'fake-tooltip' }, slots.default?.())
        },
      }),
      'el-popover': defineComponent({
        setup(_, { slots }) {
          return () => h('div', { class: 'fake-popover' }, [slots.reference?.(), slots.default?.()])
        },
      }),
    }
  })

  it('shows compact status and navigates only through visible errors', async () => {
    const wrapper = mount(DataGridValidationCenter, {
      props: {
        validating: false,
        items: [visibleItem, filteredItem, secondVisibleItem],
        currentErrorKey: secondVisibleItem.key,
      },
    })

    expect(wrapper.text()).toContain('3 个校验错误')
    expect(wrapper.find('.data-grid-validation-center__progress').text()).toBe('2/2')
    await wrapper.findAll('.data-grid-validation-center__nav')[0].trigger('click')
    expect(wrapper.emitted('previous')).toHaveLength(1)
    expect(
      wrapper.findAll('.data-grid-validation-center__nav')[1].attributes('disabled'),
    ).toBeDefined()
    wrapper.unmount()
  })

  it('emits explicit actions for visible, filtered and hidden-column errors', async () => {
    const wrapper = mount(DataGridValidationCenter, {
      props: {
        validating: false,
        items: [visibleItem, filteredItem, hiddenColumnItem],
        currentErrorKey: visibleItem.key,
      },
    })

    await wrapper.find('button.data-grid-validation-center__error').trigger('click')
    expect(wrapper.emitted('locate')?.[0]).toEqual([visibleItem])

    const actionButtons = wrapper.findAll(
      '.data-grid-validation-center__unavailable el-button-stub',
    )
    await actionButtons[0].trigger('click')
    await actionButtons[1].trigger('click')
    expect(wrapper.emitted('clear-filters-and-locate')?.[0]).toEqual([filteredItem])
    expect(wrapper.emitted('open-column-setting')).toHaveLength(1)
    wrapper.unmount()
  })
})
