<script setup lang="ts">
/**
 * 组件名称：DataGrid 演示场景渲染器
 * 使用场景：供文档长页和独立预览页共用，负责装配场景卡片并通过重新挂载恢复初始状态。
 */

import { ref } from 'vue'
import type { DemoDefinition } from '@demo/demo.types'
import DemoCard from './DemoCard.vue'

/** DataGrid 演示场景渲染器属性。 */
interface Props {
  /** 需要渲染的场景注册信息。 */
  scene: DemoDefinition

  /** 是否在场景卡片中展示独立预览入口。 */
  showPreviewLink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPreviewLink: true,
})
const renderKey = ref(0)

function resetScene() {
  renderKey.value += 1
}
</script>

<template>
  <div class="demo-scene">
    <!-- DataGrid 演示卡片 -->
    <DemoCard :scene="props.scene" :show-preview-link="props.showPreviewLink" @reset="resetScene">
      <!-- 注册场景中的真实 DataGrid 演示 -->
      <component :is="props.scene.component" :key="renderKey" />
    </DemoCard>
  </div>
</template>

<style scoped>
.demo-scene {
  width: 100%;
}
</style>
