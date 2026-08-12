// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import DataGridPopupEditorHost from './DataGridPopupEditorHost.vue'
import type { DataGridPopupEditorContext, DataGridPopupEditorExpose } from './popupEditor'

/** 测试中按 visible 状态渲染默认插槽的浮层替身。 */
const PopoverStub = defineComponent({
  name: 'ElPopover',
  props: {
    /** 当前浮层是否可见。 */
    visible: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    return () => (props.visible ? h('div', { class: 'popover-stub' }, slots.default?.()) : null)
  },
})

/** 测试中同步 textarea 草稿的输入框替身。 */
const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    /** 当前受控文本值。 */
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: {
    /** 用户输入时同步最新文本。 */
    'update:modelValue': (value: string) => typeof value === 'string',
  },
  setup(props, { emit }) {
    return () =>
      h('textarea', {
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value),
      })
  },
})

/** 测试中保留点击行为的按钮替身。 */
const ButtonStub = defineComponent({
  name: 'ElButton',
  setup(_, { slots }) {
    return () => h('button', slots.default?.())
  },
})

describe('DataGridPopupEditorHost', () => {
  it('keeps textarea changes local until confirm and discards them on cancel', async () => {
    const confirm = vi.fn(() => true)
    const row = { id: 1, remark: '原值' }
    const wrapper = mount(DataGridPopupEditorHost, {
      global: {
        stubs: {
          ElPopover: PopoverStub,
          ElInput: InputStub,
          ElButton: ButtonStub,
        },
      },
    })
    const host = wrapper.vm as unknown as DataGridPopupEditorExpose
    const context: DataGridPopupEditorContext<typeof row> = {
      anchor: document.createElement('div'),
      type: 'textarea' as const,
      rowKey: 1,
      row,
      dataIndex: 0,
      displayIndex: 0,
      column: { field: 'remark', title: '补充说明' },
      editor: { type: 'textarea' as const },
      value: '原值',
      confirm,
    }

    host.open(context)
    await nextTick()
    await nextTick()
    await wrapper.find('textarea').setValue('取消值')
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    await buttons[0]?.trigger('click')
    expect(confirm).not.toHaveBeenCalled()

    host.open(context)
    await nextTick()
    await nextTick()
    await wrapper.find('textarea').setValue('确认值')
    await wrapper.findAll('button')[1]?.trigger('click')

    expect(confirm).toHaveBeenCalledWith('确认值')
    expect(wrapper.find('.popover-stub').exists()).toBe(false)
  })
})
