<script setup lang="ts">
/**
 * 组件名称：DataGrid 复制行设置弹窗
 * 使用场景：用于配置复制所选行时额外新增的行数和插入位置。
 */

import { ref } from 'vue'
import type { DataGridRowCopyMode } from './types'

/** 复制行弹窗实际使用的表单实例能力。 */
interface DataGridRowCopyFormInstance {
  /** 清除当前表单的校验提示。 */
  clearValidate: () => void

  /** 校验当前表单并返回是否通过。 */
  validate: () => Promise<boolean>
}

/** 复制行弹窗的单条表单校验规则。 */
interface DataGridRowCopyFormRule {
  /** 当前字段是否必填。 */
  required?: boolean

  /** 校验失败时展示的消息。 */
  message?: string

  /** 触发当前规则的表单交互。 */
  trigger?: string | string[]

  /** 执行自定义行数校验。 */
  validator?: (_rule: unknown, value: string, callback: (error?: Error) => void) => void
}

/** 复制行弹窗按字段维护的表单校验规则。 */
type DataGridRowCopyFormRules = Record<string, DataGridRowCopyFormRule[]>

/** 复制行设置弹窗的属性。 */
interface Props {
  /** 每次打开弹窗时默认填写的额外新增行数。 */
  defaultCount: number

  /** 允许填写的最小额外新增行数。 */
  min: number

  /** 允许填写的最大额外新增行数。 */
  max: number

  /** 每次打开弹窗时默认选中的新增位置。 */
  defaultMode: DataGridRowCopyMode
}

/** 复制行设置表单。 */
interface RowCopyForm {
  /** 本次额外新增的行数。 */
  count: string

  /** 本次采用的新增位置。 */
  mode: DataGridRowCopyMode
}

const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits<{
  /** 用户确认且行数校验通过后触发。 */
  confirm: [form: { count: number; mode: DataGridRowCopyMode }]
}>()

const visible = ref(false)
const formRef = ref<DataGridRowCopyFormInstance>()
const form = ref<RowCopyForm>({
  count: String(props.defaultCount),
  mode: props.defaultMode,
})

const rules: DataGridRowCopyFormRules = {
  count: [
    { required: true, message: '请输入行数', trigger: ['blur', 'change'] },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        const count = Number(value)
        if (
          !/^\d+$/.test(value) ||
          !Number.isInteger(count) ||
          count < props.min ||
          count > props.max
        ) {
          callback(new Error(`请输入 ${props.min}-${props.max} 的整数`))
          return
        }
        callback()
      },
      trigger: ['blur', 'change'],
    },
  ],
}

/** 使用默认配置打开复制行弹窗。 */
function open() {
  form.value = {
    count: String(props.defaultCount),
    mode: props.defaultMode,
  }
  visible.value = true
  formRef.value?.clearValidate()
}

/** 关闭弹窗且不保留当前设置。 */
function close() {
  visible.value = false
}

/** 校验复制行设置并提交给 DataGrid。 */
async function confirm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }
  emit('confirm', {
    count: Number(form.value.count),
    mode: form.value.mode,
  })
  close()
}

defineExpose({
  open,
  close,
})
</script>

<template>
  <el-dialog
    v-model="visible"
    class="row-copy-dialog"
    title="复制行设置"
    width="420px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="行数" prop="count">
        <el-input
          v-model="form.count"
          type="number"
          inputmode="numeric"
          :min="min"
          :max="max"
          step="1"
          placeholder="请输入"
        />
      </el-form-item>
      <el-form-item label="插入位置">
        <el-radio-group v-model="form.mode" class="row-copy-dialog__mode">
          <el-radio label="insert">插入式</el-radio>
          <el-radio label="append">追加式</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" @click="confirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.row-copy-dialog {
  .row-copy-dialog__mode {
    display: flex;
    gap: 28px;
  }
}
</style>
