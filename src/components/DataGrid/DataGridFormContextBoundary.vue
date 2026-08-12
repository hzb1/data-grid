<script setup lang="ts">
/**
 * 组件名称：DataGrid 表单禁用边界
 * 使用场景：避免外层 Element Plus 表单的禁用状态影响 DataGrid 内部只读态仍可使用的工具。
 */

import { formContextKey } from 'element-plus'
import { provide } from 'vue'

// DataGrid 内部工具由自身 mode、disabled 和 loading 控制，不继承外层业务表单的禁用状态。
provide(formContextKey, undefined as never)
</script>

<template>
  <slot />
</template>
