// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CellRenderer from './CellRenderer.vue'

describe('DataGrid CellRenderer', () => {
  it('refreshes changed row params without remounting the renderer', async () => {
    const gridCell = document.createElement('div')
    const setTooltip = vi.fn()
    const wrapper = mount(CellRenderer, {
      props: {
        params: {
          value: '修改前',
          data: { id: 1, name: '修改前' },
          dataIndex: 0,
          displayIndex: 0,
          node: {},
          dataGridErrorMessage: '修改前校验错误',
          dataGridTooltipText: '修改前提示',
          dataGridTooltipMode: 'always',
          eGridCell: gridCell,
          setTooltip,
        },
      },
    })
    const rendererElement = wrapper.get('.data-grid-cell').element

    wrapper.vm.refresh({
      value: '修改后',
      data: { id: 1, name: '修改后' },
      dataIndex: 0,
      displayIndex: 0,
      node: {},
      dataGridTooltipText: '修改后提示',
      dataGridTooltipMode: 'always',
      eGridCell: gridCell,
      setTooltip,
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.data-grid-cell').element).toBe(rendererElement)
    expect(wrapper.text()).toBe('修改后')
    expect(gridCell.hasAttribute('aria-invalid')).toBe(false)
    expect(setTooltip).toHaveBeenLastCalledWith('修改后提示', expect.any(Function))
    wrapper.unmount()
  })

  it('renders each pinned summary value on an independent line', async () => {
    const wrapper = mount(CellRenderer, {
      props: {
        params: {
          value: ['原结算：1,200.00', '本次结算：300.00'],
          data: {},
          dataIndex: -1,
          displayIndex: -1,
          node: { rowPinned: 'bottom' },
        },
      },
    })

    expect(wrapper.findAll('.data-grid-cell__summary-line').map((line) => line.text())).toEqual([
      '原结算：1,200.00',
      '本次结算：300.00',
    ])
    await wrapper.setProps({
      params: {
        ...wrapper.props('params'),
        value: ['原结算：1,200.00', '本次结算：500.00'],
      },
    })
    expect(wrapper.findAll('.data-grid-cell__summary-line')[1].text()).toBe('本次结算：500.00')
    wrapper.unmount()
  })

  it('checks nested custom content before showing overflow tooltips', () => {
    const gridCell = document.createElement('div')
    const setTooltip = vi.fn()
    const wrapper = mount(CellRenderer, {
      attachTo: gridCell,
      props: {
        params: {
          value: 'LT-20260603-0008-广西中力物流有限公司',
          data: { id: 1 },
          dataIndex: 0,
          displayIndex: 0,
          node: {},
          eGridCell: gridCell,
          setTooltip,
          dataGridTooltipText: 'LT-20260603-0008-广西中力物流有限公司',
          dataGridTooltipMode: 'overflow',
          dataGridTooltipSuppressWhileEditing: true,
        },
      },
    })
    const content = wrapper.get('.data-grid-cell__value').element
    const linkInner = document.createElement('span')
    Object.defineProperties(content, {
      clientWidth: { configurable: true, value: 120 },
      scrollWidth: { configurable: true, value: 120 },
    })
    Object.defineProperties(linkInner, {
      clientWidth: { configurable: true, value: 80 },
      scrollWidth: { configurable: true, value: 160 },
    })
    content.append(linkInner)

    expect(setTooltip).toHaveBeenCalledOnce()
    expect(setTooltip.mock.calls[0][1]()).toBe(true)
    gridCell.classList.add('ag-cell-inline-editing')
    expect(setTooltip.mock.calls[0][1]()).toBe(false)
    wrapper.unmount()
  })

  it('marks invalid cells without rendering validation text inside the cell', () => {
    const gridCell = document.createElement('div')
    const wrapper = mount(CellRenderer, {
      props: {
        params: {
          value: '',
          data: { id: 1, name: '' },
          dataIndex: 0,
          displayIndex: 0,
          node: {},
          dataGridErrorMessage: '名称不能为空',
          eGridCell: gridCell,
        },
      },
    })

    expect(gridCell.getAttribute('aria-invalid')).toBe('true')
    expect(wrapper.find('.data-grid-cell').attributes('aria-invalid')).toBe('true')
    expect(wrapper.text()).not.toContain('校验错误：名称不能为空')
    expect(wrapper.find('.data-grid-cell__error').exists()).toBe(false)

    wrapper.unmount()
    expect(gridCell.hasAttribute('aria-invalid')).toBe(false)
  })

  it('keeps loading statuses out of the visible content flow and exposes accessible labels', () => {
    const validation = mount(CellRenderer, {
      props: {
        params: {
          value: '待校验',
          data: { id: 1, name: '待校验' },
          dataIndex: 0,
          displayIndex: 0,
          node: {},
          dataGridLoading: {
            visible: true,
            type: 'validation',
            text: '校验中',
            blockInteraction: false,
          },
        },
      },
    })

    expect(validation.find('.data-grid-cell__status').exists()).toBe(true)
    expect(validation.find('.data-grid-cell__spinner').exists()).toBe(false)
    expect(validation.find('[role="status"]').attributes('aria-label')).toBe('校验中')
    expect(validation.text()).toBe('待校验')
    validation.unmount()

    const processing = mount(CellRenderer, {
      props: {
        params: {
          value: '1200',
          data: { id: 1, amount: 1200 },
          dataIndex: 0,
          displayIndex: 0,
          node: {},
          dataGridLoading: {
            visible: true,
            type: 'processing',
            text: '计算中',
            blockInteraction: true,
          },
        },
      },
    })

    expect(processing.find('.data-grid-cell__status').exists()).toBe(true)
    expect(processing.find('.data-grid-cell__spinner').exists()).toBe(false)
    expect(processing.find('[role="status"]').attributes('aria-label')).toBe('计算中')
    expect(processing.text()).toBe('1200')
    processing.unmount()
  })
})
