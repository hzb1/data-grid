<script setup lang="ts">
/**
 * 组件名称：液态玻璃容器
 * 使用场景：用于演示站顶部导航、右侧目录和小型浮动操作等低密度装饰区域。
 */

import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'

/**
 * 液态玻璃容器支持的 HTML 标签。
 *
 * - `div`：普通容器。
 * - `article`：独立内容卡片。
 * - `nav`：导航容器。
 * - `button`：按钮容器。
 */
type LiquidGlassTag = 'div' | 'article' | 'nav' | 'button'

/** 液态玻璃容器属性。 */
interface Props {
  /** 渲染成的 HTML 标签。 */
  as?: LiquidGlassTag

  /** 根节点的无障碍标签。 */
  ariaLabel?: string

  /** 是否在指针悬浮时增强阴影。 */
  hoverable?: boolean

  /** 是否启用开销更高的 SVG 边缘折射。 */
  svgFilterEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: 'div',
  ariaLabel: undefined,
  hoverable: false,
  svgFilterEnabled: true,
})

const filterId = useId()
const filterUrl = computed(() => `url("#${filterId}")`)
const rootRef = ref<HTMLElement | null>(null)
const displacementMap = ref('')
let resizeObserver: ResizeObserver | null = null

function buildDisplacementMap(width: number, height: number, radius: number) {
  const actualWidth = Math.max(1, Math.round(width))
  const actualHeight = Math.max(1, Math.round(height))
  const borderRadius = Math.max(0, Math.round(radius))
  const safeId = filterId.replace(/[^\w-]/g, '-')
  const redGradientId = `red-${safeId}`
  const blueGradientId = `blue-${safeId}`

  /*
   * 中心遮罩让位移主要发生在边缘，避免导航文字和目录正文被大面积扭曲；
   * 如果修改折射强度，需要同步检查移动端小尺寸菜单的文字清晰度。
   */
  const svgContent = `
    <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${redGradientId}" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="red"/>
        </linearGradient>
        <linearGradient id="${blueGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0000"/>
          <stop offset="100%" stop-color="blue"/>
        </linearGradient>
      </defs>
      <rect width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradientId})"/>
      <rect width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradientId})" style="mix-blend-mode:difference"/>
      <rect x="3" y="3" width="${Math.max(1, actualWidth - 6)}" height="${Math.max(1, actualHeight - 6)}" rx="${borderRadius}" fill="hsl(0 0% 50% / 0.92)" style="filter:blur(5px)"/>
    </svg>
  `

  displacementMap.value = `data:image/svg+xml,${encodeURIComponent(svgContent)}`
}

function updateDisplacementMap() {
  if (!rootRef.value) {
    return
  }

  const rect = rootRef.value.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return
  }

  const radius = Number.parseFloat(getComputedStyle(rootRef.value).borderTopLeftRadius) || 22
  buildDisplacementMap(rect.width, rect.height, Math.min(radius, rect.height / 2))
}

function stopSvgFilter() {
  resizeObserver?.disconnect()
  resizeObserver = null
  displacementMap.value = ''
}

function startSvgFilter() {
  if (!props.svgFilterEnabled || !rootRef.value) {
    return
  }

  updateDisplacementMap()
  resizeObserver = new ResizeObserver(updateDisplacementMap)
  resizeObserver.observe(rootRef.value)
}

onMounted(startSvgFilter)
onUnmounted(stopSvgFilter)

watch(
  () => props.svgFilterEnabled,
  async (enabled) => {
    stopSvgFilter()
    if (!enabled) {
      return
    }

    await nextTick()
    startSvgFilter()
  },
)
</script>

<template>
  <component
    :is="props.as"
    ref="rootRef"
    class="liquid-glass"
    :class="{
      'is-hoverable': props.hoverable,
      'is-svg-filter-enabled': props.svgFilterEnabled,
    }"
    :aria-label="props.ariaLabel"
    :type="props.as === 'button' ? 'button' : undefined"
    :style="props.svgFilterEnabled ? { '--liquid-glass-filter': filterUrl } : undefined"
  >
    <svg
      v-if="props.svgFilterEnabled"
      class="liquid-glass__filter"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          :id="filterId"
          color-interpolation-filters="sRGB"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
        >
          <feImage
            v-if="displacementMap"
            :href="displacementMap"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            result="displacement"
            :scale="-34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur in="displacement" stdDeviation="0.35" />
        </filter>
      </defs>
    </svg>

    <div class="liquid-glass__content">
      <slot />
    </div>
  </component>
</template>

<style scoped lang="scss">
.liquid-glass {
  position: relative;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 70%);
  border-radius: 22px;
  color: inherit;
  background:
    linear-gradient(132deg, rgb(255 255 255 / 68%), rgb(255 255 255 / 30%)), rgb(239 245 255 / 32%);
  box-shadow:
    0 1px 0 rgb(255 255 255 / 78%) inset,
    0 14px 42px rgb(42 66 116 / 10%);
  backdrop-filter: blur(16px) saturate(135%) brightness(1.04);
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease;

  &.is-svg-filter-enabled {
    /* SVG 滤镜只增强边缘折射，基础毛玻璃仍可在不支持滤镜的浏览器中独立工作。 */
    backdrop-filter: var(--liquid-glass-filter) blur(16px) saturate(135%) brightness(1.04);
  }

  &.is-hoverable:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgb(255 255 255 / 86%) inset,
      0 18px 46px rgb(42 66 116 / 14%);
  }

  &:focus-visible {
    outline: 2px solid var(--demo-brand);
    outline-offset: 3px;
  }

  &::after {
    /* 弱内缘在浅色背景光斑上保持玻璃轮廓，同时避免形成实体卡片的厚重描边。 */
    position: absolute;
    inset: 1px;
    z-index: 0;
    border-radius: inherit;
    box-shadow: 0 0 0 0.5px rgb(255 255 255 / 45%) inset;
    content: '';
    pointer-events: none;
  }

  .liquid-glass__filter {
    position: absolute;
    inset: 0;
    z-index: -1;
    width: 100%;
    height: 100%;
    opacity: 0;
    pointer-events: none;
  }

  .liquid-glass__content {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }
}

@media (prefers-reduced-motion: reduce) {
  .liquid-glass {
    transition-duration: 0.01ms;
  }
}
</style>
