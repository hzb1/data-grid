<script setup lang="ts">
/**
 * 组件名称：DataGrid 演示卡片
 * 使用场景：用于统一承载真实表格场景、能力标签、重置入口、独立预览和多标签源码。
 */

import { computed, onUnmounted, ref } from 'vue'
import { getDemoPreviewHref } from '@demo/demo-registry'
import type { DemoCodeTab, DemoDefinition } from '@demo/demo.types'

/** DataGrid 演示卡片属性。 */
interface Props {
  /** 当前卡片渲染的完整场景注册信息。 */
  scene: DemoDefinition

  /** 是否展示跳转到独立场景页面的入口。 */
  showPreviewLink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showPreviewLink: true,
})

const emit = defineEmits<{
  /** 用户点击重置按钮并希望恢复当前演示初始状态时触发。 */
  reset: []
}>()

/**
 * 代码复制操作的即时反馈状态。
 *
 * - `idle`：尚未复制或反馈已经结束。
 * - `success`：代码已经成功写入剪贴板。
 * - `error`：浏览器拒绝写入剪贴板或复制失败。
 */
type CopyState = 'idle' | 'success' | 'error'

const codeExpanded = ref(false)
const copyState = ref<CopyState>('idle')
const resetConfirmed = ref(false)
const activeCodeTabId = ref<DemoCodeTab['id']>('complete')
const activeCodeTab = computed(
  () =>
    props.scene.codeTabs.find((tab) => tab.id === activeCodeTabId.value) ?? props.scene.codeTabs[0],
)
const previewHref = computed(() => getDemoPreviewHref(props.scene.id))
const copyButtonLabel = computed(() => {
  if (copyState.value === 'success') {
    return '✓ 已复制'
  }
  if (copyState.value === 'error') {
    return '复制失败'
  }
  return '复制当前代码'
})
const copyLiveMessage = computed(() => {
  if (copyState.value === 'success') {
    return `${activeCodeTab.value?.label ?? '当前'}代码已复制`
  }
  if (copyState.value === 'error') {
    return '代码复制失败，请手动选择代码'
  }
  return ''
})
let copyTimerId = 0
let resetTimerId = 0

async function copyCode() {
  if (!activeCodeTab.value) {
    return
  }

  window.clearTimeout(copyTimerId)
  try {
    await navigator.clipboard.writeText(activeCodeTab.value.source)
    copyState.value = 'success'
  } catch {
    copyState.value = 'error'
  }
  copyTimerId = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 1600)
}

function resetDemo() {
  emit('reset')
  window.clearTimeout(resetTimerId)
  resetConfirmed.value = true
  resetTimerId = window.setTimeout(() => {
    resetConfirmed.value = false
  }, 1400)
}

function selectCodeTab(tabId: DemoCodeTab['id']) {
  activeCodeTabId.value = tabId
  copyState.value = 'idle'
  window.clearTimeout(copyTimerId)
}

function onTabKeydown(event: KeyboardEvent, currentIndex: number) {
  const lastIndex = props.scene.codeTabs.length - 1
  let nextIndex = currentIndex

  if (event.key === 'ArrowRight') {
    nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1
  } else if (event.key === 'ArrowLeft') {
    nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1
  } else if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = lastIndex
  } else {
    return
  }

  event.preventDefault()
  const nextTab = props.scene.codeTabs[nextIndex]
  if (!nextTab) {
    return
  }

  selectCodeTab(nextTab.id)
  const tabButtons = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabButtons?.[nextIndex]?.focus()
}

onUnmounted(() => {
  window.clearTimeout(copyTimerId)
  window.clearTimeout(resetTimerId)
})
</script>

<template>
  <article class="demo-card">
    <header class="demo-card__header">
      <div>
        <div class="demo-card__meta">
          <span>{{ scene.level }}</span>
          <code v-for="apiName in scene.apiNames" :key="apiName">{{ apiName }}</code>
        </div>
        <h3 class="demo-card__title">{{ scene.title }}</h3>
        <p class="demo-card__description">{{ scene.description }}</p>
      </div>
      <div class="demo-card__actions">
        <a v-if="props.showPreviewLink" :href="previewHref" target="_blank" rel="noreferrer">
          独立预览 ↗
        </a>
        <button type="button" @click="resetDemo">
          {{ resetConfirmed ? '✓ 已重置' : '重置演示' }}
        </button>
      </div>
    </header>

    <div class="demo-card__stage" :class="{ 'is-reset': resetConfirmed }">
      <slot />
    </div>

    <footer class="demo-card__footer">
      <p class="demo-card__hint"><span>试一试</span>{{ scene.hint }}</p>
      <button
        class="demo-card__code-toggle"
        type="button"
        :aria-expanded="codeExpanded"
        :aria-controls="`${scene.id}-code-shell`"
        @click="codeExpanded = !codeExpanded"
      >
        <span aria-hidden="true">&lt;/&gt;</span>
        {{ codeExpanded ? '收起代码' : '查看代码' }}
      </button>
    </footer>

    <div
      :id="`${scene.id}-code-shell`"
      class="demo-card__code-shell"
      :class="{ 'is-expanded': codeExpanded }"
    >
      <div
        class="demo-card__code"
        :class="{ 'is-visible': codeExpanded }"
        :aria-hidden="!codeExpanded"
        :inert="!codeExpanded"
      >
        <div class="demo-card__code-bar">
          <div class="demo-card__tabs" role="tablist" aria-label="示例代码类型">
            <button
              v-for="(tab, index) in scene.codeTabs"
              :id="`${scene.id}-${tab.id}-tab`"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-controls="`${scene.id}-code-panel`"
              :aria-selected="activeCodeTabId === tab.id"
              :tabindex="activeCodeTabId === tab.id ? 0 : -1"
              :class="{ 'is-active': activeCodeTabId === tab.id }"
              @click="selectCodeTab(tab.id)"
              @keydown="onTabKeydown($event, index)"
            >
              {{ tab.label }}
            </button>
          </div>
          <button type="button" @click="copyCode">{{ copyButtonLabel }}</button>
        </div>
        <Transition name="demo-card-tab" mode="out-in">
          <pre
            :id="`${scene.id}-code-panel`"
            :key="activeCodeTabId"
            role="tabpanel"
            :aria-labelledby="`${scene.id}-${activeCodeTabId}-tab`"
          ><code>{{ activeCodeTab?.source }}</code></pre>
        </Transition>
      </div>
    </div>
    <span class="demo-card__live" aria-live="polite">{{ copyLiveMessage }}</span>
  </article>
</template>

<style scoped lang="scss">
.demo-card {
  position: relative;
  overflow: hidden;
  border: 0;
  border-radius: var(--demo-radius-lg);
  background: var(--demo-surface);
  box-shadow: var(--demo-card-shadow);
  transition: box-shadow 180ms ease;

  &:hover {
    box-shadow: var(--demo-card-shadow-hover);
  }

  .demo-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 26px 28px 22px;
  }

  .demo-card__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;

    code {
      padding: 3px 7px;
      border: 0;
      border-radius: 6px;
      color: #68758a;
      font-size: 10.5px;
      background: #f1f4f8;
    }

    span {
      padding: 3px 7px;
      border: 0;
      border-radius: var(--demo-radius-pill);
      color: #315fae;
      font-size: 10.5px;
      font-weight: 700;
      background: #edf3ff;
    }
  }

  .demo-card__title {
    margin: 0 0 6px;
    color: #182236;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.4;
    letter-spacing: -0.015em;
  }

  .demo-card__description {
    margin: 0;
    color: var(--demo-muted);
    font-size: 14px;
    line-height: 1.65;
  }

  .demo-card__actions a,
  .demo-card__actions button,
  .demo-card__code-toggle,
  .demo-card__code-bar button {
    border: 0;
    border-radius: var(--demo-radius-sm);
    color: #667286;
    background: transparent;
    cursor: pointer;
    transition:
      color var(--demo-motion-fast) ease,
      background-color var(--demo-motion-fast) ease;

    &:hover {
      color: var(--demo-brand);
      background: #f1f5fc;
    }
  }

  .demo-card__actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 4px;

    a,
    button {
      min-height: 32px;
      padding: 6px 8px;
      font-size: 13px;
      text-decoration: none;
    }
  }

  .demo-card__stage {
    padding: 0 28px 28px;

    /*
     * 官网演示需要比组件默认主题更安静的冷灰表面；
     * 覆盖限制在 DemoCard 内，避免改变 DataGrid 包对业务项目暴露的默认外观。
     */
    :deep(.data-grid__grid) {
      --ag-font-size: 13px;
      --ag-foreground-color: #303a4b;
      --ag-secondary-foreground-color: #697588;
      --ag-border-color: transparent;
      --ag-row-border-color: transparent;
      --ag-header-background-color: #fafbfc;
      --ag-header-foreground-color: #3b4659;
      --ag-row-hover-color: #f7faff;
      --ag-selected-row-background-color: #edf4ff;
      --ag-odd-row-background-color: #fff;
      --ag-wrapper-border-radius: 10px;
      --ag-header-column-separator-color: transparent;
      --ag-header-column-separator-height: 44%;

      border-radius: 10px;
      box-shadow: none;
    }

    :deep(.data-grid__grid-container) {
      border-radius: 10px;
      box-shadow: none;
    }

    :deep(.ag-root-wrapper) {
      border: 0;
    }

    :deep(.ag-header-cell-text) {
      font-weight: 620;
      letter-spacing: 0.01em;
    }

    :deep(.ag-header) {
      border-bottom: 0;
    }

    :deep(.ag-cell) {
      border: 0;
      font-variant-numeric: tabular-nums;
    }

    :deep(.ag-row::after) {
      display: none;
    }

    :deep(.ag-row-pinned .ag-cell),
    :deep(.data-grid__summary-cell) {
      color: #283346;
      background: #f5f7fb;
    }

    :deep(.ag-body-horizontal-scroll-viewport::-webkit-scrollbar),
    :deep(.ag-body-vertical-scroll-viewport::-webkit-scrollbar),
    :deep(.ag-center-cols-viewport::-webkit-scrollbar) {
      width: 5px;
      height: 5px;
    }

    :deep(.ag-body-horizontal-scroll-viewport::-webkit-scrollbar-thumb),
    :deep(.ag-body-vertical-scroll-viewport::-webkit-scrollbar-thumb),
    :deep(.ag-center-cols-viewport::-webkit-scrollbar-thumb) {
      border-radius: var(--demo-radius-pill);
      background: #c5cdd9;
    }

    &.is-reset {
      animation: demo-card-reset 700ms var(--demo-ease-out);
    }
  }

  .demo-card__footer {
    display: flex;
    min-height: 58px;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 13px 28px;
    border-top: 0;
    background: #fff;
  }

  .demo-card__hint {
    margin: 0;
    color: #788397;
    font-size: 12.5px;
    line-height: 1.6;

    span {
      display: inline-flex;
      margin-right: 8px;
      padding: 2px 6px;
      border-radius: 5px;
      color: var(--demo-brand);
      font-size: 11px;
      font-weight: 700;
      background: #edf3ff;
    }
  }

  .demo-card__code-toggle {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 6px 8px;
    font-size: 13px;
  }

  /*
   * 网格行从 0fr 过渡到 1fr，让代码显隐与页面高度同步变化；
   * 修改内部 overflow 时需同时检查隐藏状态下的键盘焦点与长代码滚动。
   */
  .demo-card__code-shell {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition:
      grid-template-rows var(--demo-motion-normal) var(--demo-ease-out),
      opacity var(--demo-motion-normal) var(--demo-ease-out);

    &.is-expanded {
      grid-template-rows: 1fr;
      opacity: 1;
    }
  }

  .demo-card__code {
    min-height: 0;
    overflow: hidden;
    border-top: 0;
    visibility: hidden;
    background: var(--demo-soft);

    &.is-visible {
      visibility: visible;
    }

    pre {
      max-height: 520px;
      margin: 0;
      padding: 20px 24px 26px;
      overflow: auto;
      color: #27344a;
      font-size: 12.5px;
      line-height: 1.78;
      tab-size: 2;
    }
  }

  .demo-card__code-bar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 0;
    color: #788498;
    font-size: 12px;
    background: var(--demo-surface-soft);

    > button {
      padding: 3px 0;
      font-size: 12px;
    }
  }

  .demo-card__tabs {
    display: flex;
    align-items: center;
    gap: 4px;

    button {
      padding: 5px 9px;
      border: 0;
      border-radius: var(--demo-radius-sm);

      &:hover {
        background: #f0f3f8;
      }

      &.is-active {
        color: #315fae;
        background: #fff;
        box-shadow: 0 1px 2px rgb(32 52 84 / 5%);
      }
    }
  }

  .demo-card__live {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .demo-card-tab-enter-active,
  .demo-card-tab-leave-active {
    transition: opacity var(--demo-motion-fast) ease;
  }

  .demo-card-tab-enter-from,
  .demo-card-tab-leave-to {
    opacity: 0;
  }
}

@keyframes demo-card-reset {
  0%,
  100% {
    box-shadow: inset 0 0 0 1px rgb(53 104 212 / 0%);
  }

  40% {
    box-shadow: inset 0 0 0 2px rgb(53 104 212 / 22%);
  }
}

@media (max-width: 767px) {
  .demo-card {
    border-radius: 14px;

    .demo-card__header {
      padding: 20px 16px 18px;
    }

    .demo-card__stage {
      padding-right: 14px;
      padding-bottom: 22px;
      padding-left: 14px;
    }

    .demo-card__footer {
      align-items: flex-start;
      padding: 14px 16px;
    }

    .demo-card__header,
    .demo-card__code-bar {
      flex-direction: column;
    }

    .demo-card__actions,
    .demo-card__code-bar {
      width: 100%;
      align-items: flex-start;
    }

    .demo-card__code-bar {
      gap: 12px;
      padding-right: 16px;
      padding-left: 16px;
    }

    .demo-card__title {
      font-size: 17px;
    }

    .demo-card__description {
      font-size: 13px;
    }

    .demo-card__meta {
      gap: 5px;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-card {
    .demo-card__stage {
      &.is-reset {
        animation: none;
        box-shadow: inset 0 0 0 2px rgb(53 104 212 / 22%);
      }
    }
  }
}
</style>
