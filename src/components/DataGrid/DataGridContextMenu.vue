<script setup lang="ts">
/**
 * 组件名称：DataGrid 右键菜单
 * 使用场景：用于在 DataGrid 单元格选区上提供选区复制和整行复制入口。
 */

import { CopyDocument, DocumentCopy, Files, Tickets } from '@element-plus/icons-vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** DataGrid 右键菜单属性。 */
interface Props {
  /** 是否展示右键菜单。 */
  visible: boolean

  /** 菜单触发点相对浏览器视口的横坐标。 */
  x: number

  /** 菜单触发点相对浏览器视口的纵坐标。 */
  y: number
}

const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits<{
  /** 用户点击菜单外部、滚动页面、调整窗口或按下 Esc 时触发。 */
  close: []

  /** 用户点击不含表头的复制菜单项时触发。 */
  copy: []

  /** 用户点击包含表头的复制菜单项时触发。 */
  'copy-with-headers': []

  /** 用户点击不含表头的整行复制菜单项时触发。 */
  'copy-rows': []

  /** 用户点击包含表头的整行复制菜单项时触发。 */
  'copy-rows-with-headers': []
}>()

const menuRef = ref<HTMLElement>()
const left = ref(0)
const top = ref(0)

const menuStyle = computed(() => ({
  left: `${left.value}px`,
  top: `${top.value}px`,
}))

const copyShortcut = computed(() => {
  const isAppleDevice =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  return isAppleDevice ? '⌘C' : 'Ctrl+C'
})

function close() {
  emit('close')
}

function updatePosition() {
  const menu = menuRef.value
  if (!menu) {
    return
  }
  const viewportGap = 8
  const rect = menu.getBoundingClientRect()
  left.value = Math.max(
    viewportGap,
    Math.min(props.x, window.innerWidth - rect.width - viewportGap),
  )
  top.value = Math.max(
    viewportGap,
    Math.min(props.y, window.innerHeight - rect.height - viewportGap),
  )
  menu
    .querySelector<HTMLButtonElement>('.data-grid-context-menu__item')
    ?.focus({ preventScroll: true })
}

function onDocumentPointerDown(event: PointerEvent) {
  if (props.visible && !menuRef.value?.contains(event.target as Node)) {
    close()
  }
}

function onDocumentScroll() {
  if (props.visible) {
    close()
  }
}

function onWindowResize() {
  if (props.visible) {
    close()
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (props.visible && event.key === 'Escape') {
    event.preventDefault()
    close()
  }
}

watch(
  () => [props.visible, props.x, props.y],
  () => {
    if (!props.visible) {
      return
    }
    left.value = props.x
    top.value = props.y
    nextTick(updatePosition)
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('scroll', onDocumentScroll, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('scroll', onDocumentScroll, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="data-grid-context-menu"
      :style="menuStyle"
      role="menu"
      aria-label="表格复制菜单"
      @contextmenu.prevent
    >
      <button
        class="data-grid-context-menu__item"
        type="button"
        role="menuitem"
        @click="emit('copy')"
      >
        <el-icon class="data-grid-context-menu__icon"><CopyDocument /></el-icon>
        <span class="data-grid-context-menu__label">复制</span>
        <kbd class="data-grid-context-menu__shortcut">{{ copyShortcut }}</kbd>
      </button>
      <button
        class="data-grid-context-menu__item"
        type="button"
        role="menuitem"
        @click="emit('copy-with-headers')"
      >
        <el-icon class="data-grid-context-menu__icon"><DocumentCopy /></el-icon>
        <span class="data-grid-context-menu__label">复制（含表头）</span>
      </button>
      <div class="data-grid-context-menu__divider" role="separator"></div>
      <button
        class="data-grid-context-menu__item"
        type="button"
        role="menuitem"
        @click="emit('copy-rows')"
      >
        <el-icon class="data-grid-context-menu__icon"><Files /></el-icon>
        <span class="data-grid-context-menu__label">复制整行</span>
      </button>
      <button
        class="data-grid-context-menu__item"
        type="button"
        role="menuitem"
        @click="emit('copy-rows-with-headers')"
      >
        <el-icon class="data-grid-context-menu__icon"><Tickets /></el-icon>
        <span class="data-grid-context-menu__label">复制整行（含表头）</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.data-grid-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 224px;
  padding: 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);

  .data-grid-context-menu__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--el-border-radius-small);
    color: var(--el-text-color-regular);
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      outline: none;
      box-shadow: 0 0 0 1px var(--el-color-primary-light-7) inset;
    }
  }

  .data-grid-context-menu__icon {
    flex: none;
    font-size: 16px;
    color: currentColor;
  }

  .data-grid-context-menu__label {
    flex: 1;
    min-width: 0;
  }

  .data-grid-context-menu__shortcut {
    flex: none;
    padding: 1px 6px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    font-family: inherit;
    font-size: 12px;
    line-height: 18px;
  }

  .data-grid-context-menu__divider {
    height: 1px;
    margin: 5px 4px;
    background: var(--el-border-color-lighter);
  }
}
</style>
