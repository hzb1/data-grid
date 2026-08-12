/**
 * 组合函数名称：DataGrid 高度拖拽
 * 使用场景：用于固定高度 DataGrid，通过指针或键盘在配置的高度范围内调整表格高度。
 */

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 高度边界配置异常时使用的保底最小高度，单位为 px。 */
const DATA_GRID_HEIGHT_RESIZE_FALLBACK_MIN_HEIGHT = 232

/** DataGrid 高度拖拽组合函数的依赖选项。 */
interface UseDataGridHeightResizeOptions {
  /** 返回 DataGrid 根节点。 */
  getElement: () => HTMLElement | undefined

  /** 返回外部传入的表格高度。 */
  getExternalHeight: () => number | string | undefined

  /** 返回当前是否允许调整高度。 */
  isEnabled: () => boolean

  /** 返回允许调整的最小高度。 */
  getMinHeight: () => number

  /** 返回允许调整的最大高度。 */
  getMaxHeight: () => number

  /** 表格高度通过指针或键盘变化时触发。 */
  onChange: (height: number) => void

  /** 用户尝试超过最大高度时触发。 */
  onExceedMax: (maxHeight: number) => void
}

/** 将目标高度限制在当前可调整范围内。 */
function clampHeight(height: number, minHeight: number, maxHeight: number) {
  return Math.min(maxHeight, Math.max(minHeight, Math.round(height)))
}

export function useDataGridHeightResize(options: UseDataGridHeightResizeOptions) {
  const resizedHeight = ref<number>()
  const resizing = ref(false)
  const currentHeight = ref(0)
  const minHeight = ref(DATA_GRID_HEIGHT_RESIZE_FALLBACK_MIN_HEIGHT)
  const maxHeight = ref(DATA_GRID_HEIGHT_RESIZE_FALLBACK_MIN_HEIGHT)

  let activeHandle: HTMLElement | undefined
  let activePointerId: number | undefined
  let startPointerY = 0
  let startHeight = 0
  let pendingHeight: number | undefined
  let animationFrameId: number | undefined
  let previousBodyCursor = ''
  let previousBodyUserSelect = ''
  let maxWarningShown = false

  function resolveMinHeight() {
    const value = options.getMinHeight()
    return Number.isFinite(value)
      ? Math.max(0, Math.round(value))
      : DATA_GRID_HEIGHT_RESIZE_FALLBACK_MIN_HEIGHT
  }

  function refreshBounds() {
    const element = options.getElement()
    const nextMinHeight = resolveMinHeight()
    const configuredMaxHeight = options.getMaxHeight()
    const nextMaxHeight = Math.max(
      nextMinHeight,
      Number.isFinite(configuredMaxHeight) ? Math.round(configuredMaxHeight) : nextMinHeight,
    )
    minHeight.value = nextMinHeight
    maxHeight.value = nextMaxHeight
    if (!element) {
      currentHeight.value = nextMinHeight
      return
    }
    const elementRect = element.getBoundingClientRect()
    currentHeight.value = clampHeight(elementRect.height, nextMinHeight, nextMaxHeight)
  }

  function applyHeight(height: number, notifyWhenExceeded = false) {
    if (notifyWhenExceeded && height > maxHeight.value && !maxWarningShown) {
      maxWarningShown = true
      options.onExceedMax(maxHeight.value)
    }
    const nextHeight = clampHeight(height, minHeight.value, maxHeight.value)
    resizedHeight.value = nextHeight
    currentHeight.value = nextHeight
    options.onChange(nextHeight)
  }

  function flushPendingHeight() {
    animationFrameId = undefined
    if (pendingHeight === undefined) {
      return
    }
    const height = pendingHeight
    pendingHeight = undefined
    applyHeight(height, true)
  }

  function queueHeight(height: number) {
    pendingHeight = height
    if (animationFrameId === undefined) {
      animationFrameId = window.requestAnimationFrame(flushPendingHeight)
    }
  }

  function restoreDocumentInteraction() {
    document.body.style.cursor = previousBodyCursor
    document.body.style.userSelect = previousBodyUserSelect
  }

  function removePointerListeners() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
  }

  function finishResize() {
    if (!resizing.value) {
      return
    }
    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = undefined
    }
    flushPendingHeight()
    removePointerListeners()
    if (
      activeHandle &&
      activePointerId !== undefined &&
      activeHandle.hasPointerCapture(activePointerId)
    ) {
      activeHandle.releasePointerCapture(activePointerId)
    }
    activeHandle = undefined
    activePointerId = undefined
    resizing.value = false
    restoreDocumentInteraction()
  }

  function onPointerMove(event: PointerEvent) {
    if (!resizing.value || event.pointerId !== activePointerId) {
      return
    }
    event.preventDefault()
    queueHeight(startHeight + event.clientY - startPointerY)
  }

  function onPointerEnd(event: PointerEvent) {
    if (event.pointerId === activePointerId) {
      finishResize()
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (!options.isEnabled() || event.button !== 0) {
      return
    }
    const element = options.getElement()
    const handle = event.currentTarget as HTMLElement | null
    if (!element || !handle) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    refreshBounds()
    maxWarningShown = false
    startPointerY = event.clientY
    startHeight = element.getBoundingClientRect().height
    activeHandle = handle
    activePointerId = event.pointerId
    handle.setPointerCapture(event.pointerId)
    previousBodyCursor = document.body.style.cursor
    previousBodyUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    resizing.value = true
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onPointerEnd)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!options.isEnabled() || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      return
    }
    const element = options.getElement()
    if (!element) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    refreshBounds()
    maxWarningShown = false
    const renderedHeight = element.getBoundingClientRect().height
    const step = event.shiftKey ? 50 : 10
    if (event.key === 'Home') {
      applyHeight(minHeight.value)
      return
    }
    if (event.key === 'End') {
      applyHeight(maxHeight.value)
      return
    }
    applyHeight(
      renderedHeight + (event.key === 'ArrowDown' ? step : -step),
      event.key === 'ArrowDown',
    )
  }

  function resetHeight() {
    if (resizing.value) {
      return
    }
    resizedHeight.value = undefined
    void nextTick(refreshBounds)
  }

  watch(options.getExternalHeight, resetHeight)
  watch(options.isEnabled, (enabled) => {
    if (!enabled) {
      finishResize()
      return
    }
    void nextTick(refreshBounds)
  })

  onMounted(refreshBounds)
  onBeforeUnmount(() => {
    finishResize()
    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId)
    }
  })

  return {
    resizedHeight,
    resizing,
    currentHeight,
    minHeight,
    maxHeight,
    refreshBounds,
    onPointerDown,
    onKeyDown,
  }
}
