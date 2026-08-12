// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, h, markRaw, nextTick, type Component } from 'vue'
import { describe, expect, it } from 'vitest'
import DataGridEditorControl from './DataGridEditorControl.vue'
import type { DataGridCustomEditorProps, DataGridEditorConfig, DataGridRow } from './types'

/** 测试中代替 Element Plus 输入类控件的受控组件。 */
const InputStub = defineComponent({
  name: 'ElInput',
  props: {
    /** 当前受控输入值。 */
    modelValue: {
      type: [String, Number],
      default: '',
    },
    /** 当前输入框类型。 */
    type: {
      type: String,
      default: 'text',
    },
    /** 是否向外层 Element Plus 表单项触发自动校验。 */
    validateEvent: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () =>
      h(props.type === 'textarea' ? 'textarea' : 'input', {
        value: props.modelValue,
        onInput: (event: Event) =>
          emit('update:modelValue', (event.target as HTMLInputElement).value),
        onBlur: () => emit('blur'),
      })
  },
})

/** 测试中代替数值、日期、选择和开关的通用受控组件。 */
function createControlStub(name: string) {
  return defineComponent({
    name,
    props: {
      /** 当前控件的受控值。 */
      modelValue: {
        type: null,
        default: undefined,
      },
      /** 多选折叠标签是否启用。 */
      collapseTags: {
        type: Boolean,
        default: false,
      },
      /** 多选折叠标签是否展示提示。 */
      collapseTagsTooltip: {
        type: Boolean,
        default: false,
      },
      /** 多选最多展示的标签数。 */
      maxCollapseTags: {
        type: Number,
        default: undefined,
      },
      /** 数值输入允许填写的最大值。 */
      max: {
        type: Number,
        default: undefined,
      },
      /** 是否向外层 Element Plus 表单项触发自动校验。 */
      validateEvent: {
        type: Boolean,
        default: true,
      },
    },
    emits: ['update:modelValue', 'blur', 'change', 'visibleChange'],
    setup() {
      return () => h('button', { class: `stub-${name}` }, name)
    },
  })
}

const InputNumberStub = createControlStub('ElInputNumber')
const DatePickerStub = createControlStub('ElDatePicker')
const SelectStub = createControlStub('ElSelect')
const SwitchStub = createControlStub('ElSwitch')
const OptionStub = defineComponent({
  name: 'ElOption',
  setup() {
    return () => h('span')
  },
})

const row: DataGridRow = {
  id: 1,
  value: '',
}

/** 挂载一个使用指定编辑配置的共享控件。 */
function mountControl(editor: DataGridEditorConfig<DataGridRow>, modelValue: unknown = '') {
  return mount(DataGridEditorControl, {
    props: {
      modelValue,
      row,
      dataIndex: 0,
      displayIndex: 0,
      column: {
        field: 'value',
        title: '值',
        editor,
        options: [
          { label: '选项一', value: 'one' },
          { label: '选项二', value: 'two' },
        ],
      },
      editor,
      persistent: true,
    },
    global: {
      components: {
        'el-input': InputStub,
        'el-input-number': InputNumberStub,
        'el-date-picker': DatePickerStub,
        'el-select': SelectStub,
        'el-switch': SwitchStub,
        'el-option': OptionStub,
      },
    },
  })
}

describe('DataGridEditorControl', () => {
  it('keeps built-in editors from triggering the outer Element Plus form item validation', () => {
    const cases = [
      {
        editor: { type: 'text', componentProps: { validateEvent: true } } as const,
        component: InputStub,
      },
      { editor: { type: 'number' } as const, component: InputNumberStub },
      { editor: { type: 'date' } as const, component: DatePickerStub },
      { editor: { type: 'select' } as const, component: SelectStub },
      { editor: { type: 'boolean' } as const, component: SwitchStub },
    ]

    for (const item of cases) {
      const wrapper = mountControl(item.editor)
      expect(wrapper.findComponent(item.component).props('validateEvent')).toBe(false)
      wrapper.unmount()
    }
  })

  it('updates and commits text values on blur or Enter, and commits Tab without preventing focus movement', async () => {
    const wrapper = mountControl({ type: 'text' }, '原值')
    const input = wrapper.findComponent(InputStub)

    input.vm.$emit('update:modelValue', '新值')
    input.vm.$emit('blur')
    await nextTick()
    await wrapper.find('.data-grid-editor-control').trigger('keydown', { key: 'Enter' })
    await wrapper.find('.data-grid-editor-control').trigger('keydown', { key: 'Tab' })

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['新值'])
    expect(wrapper.emitted('commit')).toHaveLength(3)
  })

  it('keeps normal textarea Enter as a newline and commits Ctrl/Cmd+Enter', async () => {
    const wrapper = mountControl({ type: 'textarea' }, '第一行')
    const root = wrapper.find('.data-grid-editor-control')

    await root.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('commit')).toBeUndefined()

    await root.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('commit')).toHaveLength(1)
  })

  it('commits number on blur and date, datetime, select and boolean on value change', async () => {
    const cases = [
      { editor: { type: 'number' } as const, component: InputNumberStub, event: 'blur' },
      { editor: { type: 'date' } as const, component: DatePickerStub, event: 'change' },
      { editor: { type: 'datetime' } as const, component: DatePickerStub, event: 'change' },
      { editor: { type: 'select' } as const, component: SelectStub, event: 'change' },
      { editor: { type: 'boolean' } as const, component: SwitchStub, event: 'change' },
    ]

    for (const item of cases) {
      const wrapper = mountControl(item.editor)
      wrapper.findComponent(item.component).vm.$emit(item.event)
      await nextTick()
      expect(wrapper.emitted('commit')).toHaveLength(1)
      wrapper.unmount()
    }
  })

  it('resolves component props from the current row context', async () => {
    const wrapper = mountControl({
      type: 'number',
      componentProps: ({ row: currentRow, field, value }) => ({
        max: Number(currentRow.limit),
        placeholder: `${String(field)}:${String(value)}`,
      }),
    })
    await wrapper.setProps({
      row: {
        ...row,
        limit: 8,
      },
    })

    expect(wrapper.findComponent(InputNumberStub).props('max')).toBe(8)
  })

  it('updates a multiSelect draft while open and commits only when the dropdown closes', async () => {
    const wrapper = mountControl({ type: 'multiSelect' }, ['one'])
    const select = wrapper.findComponent(SelectStub)

    expect(select.props('collapseTags')).toBe(true)
    expect(select.props('collapseTagsTooltip')).toBe(true)
    expect(select.props('maxCollapseTags')).toBe(1)

    select.vm.$emit('update:modelValue', ['one', 'two'])
    select.vm.$emit('visibleChange', true)
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['one', 'two']])
    expect(wrapper.emitted('commit')).toBeUndefined()

    select.vm.$emit('visibleChange', false)
    await nextTick()
    expect(wrapper.emitted('commit')).toHaveLength(1)
  })

  it('lets business multiSelect props override the default collapsed-tag configuration', () => {
    const wrapper = mountControl({
      type: 'multiSelect',
      componentProps: {
        collapseTags: false,
        collapseTagsTooltip: false,
        maxCollapseTags: 3,
      },
    })
    const select = wrapper.findComponent(SelectStub)

    expect(select.props('collapseTags')).toBe(false)
    expect(select.props('collapseTagsTooltip')).toBe(false)
    expect(select.props('maxCollapseTags')).toBe(3)
  })

  it('cancels on Escape and forwards explicit commit/cancel functions to a custom editor', async () => {
    const CustomControl = defineComponent({
      name: 'CustomControl',
      props: {
        /** 确认当前自定义草稿。 */
        commit: {
          type: Function,
          required: true,
        },
        /** 撤销当前自定义草稿。 */
        cancel: {
          type: Function,
          required: true,
        },
      },
      setup() {
        return () => h('div', { class: 'custom-control' })
      },
    }) as unknown as Component<DataGridCustomEditorProps<DataGridRow>>
    const wrapper = mountControl({ type: 'custom', component: markRaw(CustomControl) })
    const custom = wrapper.findComponent({ name: 'CustomControl' })

    await wrapper.find('.data-grid-editor-control').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    ;(custom.props('commit') as () => void)()
    ;(custom.props('cancel') as () => void)()
    await nextTick()
    expect(wrapper.emitted('commit')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })
})
