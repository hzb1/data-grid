// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import DataGridPersistentEditor from './DataGridPersistentEditor.vue'

/** 测试中代替 Element Plus 输入框的受控文本组件。 */
const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    /** 当前受控输入值。 */
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: {
    /** 输入内容变化时同步最新字符串。 */
    'update:modelValue': (value: string) => typeof value === 'string',
    /** 输入框失去焦点时通知外层提交。 */
    blur: () => true,
  },
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
        onBlur: () => emit('blur'),
      })
  },
})

function createParams() {
  return {
    value: '原值',
    data: { id: 1, remark: '原值' },
    dataGridRowKey: 1,
    dataGridColumn: { field: 'remark', title: '备注' },
    node: { rowIndex: 0 },
    dataGridDataIndex: 0,
    dataGridEditor: { type: 'text' as const },
    eGridCell: document.createElement('div'),
    dataGridGetDraftValue: vi.fn((_rowKey, _field, sourceValue) => sourceValue),
    dataGridUpdateDraft: vi.fn(),
    dataGridCommitDraft: vi.fn(() => true),
    dataGridCancelDraft: vi.fn(),
    dataGridOpenPopupEditor: vi.fn(),
  }
}

describe('DataGridPersistentEditor', () => {
  it('writes drafts while typing and commits them on blur', async () => {
    const params = createParams()
    const wrapper = mount(DataGridPersistentEditor, {
      props: { params },
      global: {
        components: {
          'el-input': InputStub,
        },
      },
    })

    await wrapper.find('input').setValue('最新说明')
    await wrapper.find('input').trigger('blur')

    expect(params.dataGridUpdateDraft).toHaveBeenCalledWith(1, 'remark', '原值', '最新说明')
    expect(params.dataGridCommitDraft).toHaveBeenCalledWith(1, 'remark')
  })

  it('cancels the draft when Escape is pressed', async () => {
    const params = createParams()
    const wrapper = mount(DataGridPersistentEditor, {
      props: { params },
      global: {
        components: {
          'el-input': InputStub,
        },
      },
    })

    await wrapper.find('input').setValue('待撤销')
    await wrapper.find('.data-grid-editor-control').trigger('keydown', { key: 'Escape' })

    expect(params.dataGridCancelDraft).toHaveBeenCalledWith(1, 'remark')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('原值')
  })

  it('opens textarea in the shared popup and commits only the confirmed value', async () => {
    const params = {
      ...createParams(),
      dataGridEditor: { type: 'textarea' as const },
    }
    const wrapper = mount(DataGridPersistentEditor, {
      props: { params },
    })

    await wrapper.find('.data-grid-textarea-cell').trigger('click')

    expect(params.dataGridOpenPopupEditor).toHaveBeenCalledTimes(1)
    const context = params.dataGridOpenPopupEditor.mock.calls[0]?.[0]
    expect(context).toMatchObject({
      type: 'textarea',
      rowKey: 1,
      value: '原值',
    })

    expect(context?.confirm('浮层确认值')).toBe(true)
    expect(params.dataGridUpdateDraft).toHaveBeenCalledWith(1, 'remark', '原值', '浮层确认值')
    expect(params.dataGridCommitDraft).toHaveBeenCalledWith(1, 'remark')
  })
})
