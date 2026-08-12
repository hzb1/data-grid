<script setup lang="ts">
/**
 * 组件名称：演示场景懒挂载容器
 * 使用场景：用于文档长页中延迟初始化尚未接近视口的 DataGrid 演示。
 */

import { nextTick, onMounted, onUnmounted, ref } from 'vue'

/** 演示场景懒挂载容器属性。 */
interface Props {
  /** 是否跳过观察并立即渲染，首屏场景应开启。 */
  eager?: boolean

  /** 占位区域最小高度，避免挂载前后页面发生明显跳动。 */
  minHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  eager: false,
  minHeight: 520,
})

const rootRef = ref<HTMLElement | null>(null)
const shouldRender = ref(props.eager)
const contentReady = ref(false)
let intersectionObserver: IntersectionObserver | null = null
let enterFrameId = 0

async function revealContent() {
  await nextTick()
  enterFrameId = window.requestAnimationFrame(() => {
    enterFrameId = window.requestAnimationFrame(() => {
      contentReady.value = true
    })
  })
}

onMounted(() => {
  if (shouldRender.value) {
    void revealContent()
    return
  }

  if (!rootRef.value) {
    return
  }

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return
      }

      shouldRender.value = true
      void revealContent()
      intersectionObserver?.disconnect()
      intersectionObserver = null
    },
    { rootMargin: '600px 0px' },
  )
  intersectionObserver.observe(rootRef.value)
})

onUnmounted(() => {
  intersectionObserver?.disconnect()
  window.cancelAnimationFrame(enterFrameId)
})
</script>

<template>
  <div ref="rootRef" class="lazy-demo" :style="{ minHeight: `${props.minHeight}px` }">
    <div v-if="shouldRender" class="lazy-demo__content" :class="{ 'is-ready': contentReady }">
      <slot />
    </div>
    <div v-else class="lazy-demo__placeholder" role="status" aria-label="演示正在等待加载">
      <span class="lazy-demo__status">演示将在接近视口时加载</span>
      <div class="lazy-demo__head" aria-hidden="true">
        <div class="lazy-demo__head-copy">
          <span class="lazy-demo__line lazy-demo__line--meta" />
          <span class="lazy-demo__line lazy-demo__line--title" />
          <span class="lazy-demo__line lazy-demo__line--description" />
        </div>
        <span class="lazy-demo__line lazy-demo__line--action" />
      </div>
      <div class="lazy-demo__table" aria-hidden="true">
        <div class="lazy-demo__table-head">
          <span v-for="column in 6" :key="`head-${column}`" />
        </div>
        <div v-for="row in 6" :key="row" class="lazy-demo__row">
          <span v-for="column in 6" :key="`${row}-${column}`" />
        </div>
      </div>
      <div class="lazy-demo__foot" aria-hidden="true">
        <span class="lazy-demo__line lazy-demo__line--hint" />
        <span class="lazy-demo__line lazy-demo__line--action" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lazy-demo {
  width: 100%;

  .lazy-demo__content {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity var(--demo-motion-normal) var(--demo-ease-out),
      transform var(--demo-motion-normal) var(--demo-ease-out);

    &.is-ready {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .lazy-demo__placeholder {
    display: flex;
    min-height: inherit;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e5eaf2;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(34 52 84 / 3%);
  }

  .lazy-demo__status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .lazy-demo__head,
  .lazy-demo__foot {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 24px 26px;
  }

  .lazy-demo__head-copy {
    display: flex;
    width: min(520px, 72%);
    flex-direction: column;
    gap: 10px;
  }

  .lazy-demo__line,
  .lazy-demo__table span {
    display: block;
    border-radius: 6px;
    background: #edf1f7;
    animation: lazy-demo-skeleton 1.7s ease-in-out infinite;
  }

  .lazy-demo__line--meta {
    width: 150px;
    height: 18px;
  }

  .lazy-demo__line--title {
    width: 180px;
    height: 22px;
  }

  .lazy-demo__line--description {
    width: min(430px, 100%);
    height: 14px;
  }

  .lazy-demo__line--action {
    width: 76px;
    height: 20px;
  }

  .lazy-demo__line--hint {
    width: min(360px, 65%);
    height: 16px;
  }

  .lazy-demo__table {
    display: flex;
    min-height: 350px;
    flex: 1;
    flex-direction: column;
    margin: 0 26px;
    overflow: hidden;
    border: 1px solid #e7ebf1;
    border-radius: 8px;
    background: #fafbfd;
  }

  .lazy-demo__table-head,
  .lazy-demo__row {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    align-items: center;
    gap: 18px;
    min-height: 48px;
    padding: 0 18px;
    border-bottom: 1px solid #edf0f5;

    span {
      width: min(76px, 84%);
      height: 11px;
    }
  }

  .lazy-demo__table-head {
    background: #f3f6fa;

    span {
      height: 13px;
      background: #e2e8f1;
    }
  }

  .lazy-demo__foot {
    align-items: center;
    margin-top: auto;
    border-top: 1px solid #eef1f5;
  }
}

@keyframes lazy-demo-skeleton {
  0%,
  100% {
    opacity: 0.48;
  }

  50% {
    opacity: 0.9;
  }
}

@media (max-width: 767px) {
  .lazy-demo {
    .lazy-demo__head,
    .lazy-demo__foot {
      padding-right: 16px;
      padding-left: 16px;
    }

    .lazy-demo__table {
      margin-right: 16px;
      margin-left: 16px;
    }

    .lazy-demo__table-head,
    .lazy-demo__row {
      grid-template-columns: repeat(4, minmax(0, 1fr));

      span:nth-child(n + 5) {
        display: none;
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .lazy-demo {
    .lazy-demo__content {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .lazy-demo__line,
    .lazy-demo__table span {
      animation: none;
    }
  }
}
</style>
