/**
 * 组合函数名称：DataGrid 全屏控制
 * 使用场景：用于让单个 DataGrid 覆盖应用视口，并统一处理页面滚动、焦点、Esc 退出和多实例互斥。
 */

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DataGridFullscreenChangeSource } from '../types'

/** DataGrid 全屏控制组合函数的依赖选项。 */
interface UseDataGridFullscreenOptions {
  /** 返回 DataGrid 根节点。 */
  getElement: () => HTMLElement | undefined

  /** 返回当前是否存在应优先关闭的表格浮层或编辑器。 */
  shouldKeepFullscreenOnEscape: () => boolean

  /** 全屏状态变化并完成 DOM 更新后触发表格布局刷新。 */
  onLayoutChange: () => void

  /** 全屏状态发生变化时通知 DataGrid 对外抛出事件。 */
  onChange: (fullscreen: boolean, source: DataGridFullscreenChangeSource) => void
}

/** 当前占用应用视口的 DataGrid 实例控制器。 */
interface ActiveDataGridFullscreen {
  /** 由其他 DataGrid 进入全屏时关闭当前实例。 */
  exit: () => void
}

let activeFullscreen: ActiveDataGridFullscreen | undefined

export function useDataGridFullscreen(options: UseDataGridFullscreenOptions) {
  const fullscreen = ref(false)
  let previousBodyOverflow = ''
  let previousFocus: HTMLElement | null = null
  let layoutFrameId: number | undefined
  let disposed = false
  /** 全屏期间保留原挂载位置的占位节点，退出时据此还原表格。 */
  let fullscreenPlaceholder: Comment | undefined
  /** 表格进入全屏前所在的父节点。 */
  let fullscreenParent: ParentNode | undefined

  const controller: ActiveDataGridFullscreen = {
    exit: () => exitFullscreen('instance-change'),
  }

  function refreshLayout() {
    if (disposed) {
      return
    }
    if (layoutFrameId !== undefined) {
      window.cancelAnimationFrame(layoutFrameId)
    }
    void nextTick(() => {
      layoutFrameId = window.requestAnimationFrame(() => {
        layoutFrameId = undefined
        options.onLayoutChange()
      })
    })
  }

  function focusFullscreenTable() {
    void nextTick(() => {
      const element = options.getElement()
      element?.focus({ preventScroll: true })
    })
  }

  /**
   * 将表格根节点提升到 body，避免父级创建的层叠上下文覆盖全屏表格。
   * 占位节点确保退出全屏时能回到完全相同的位置。
   */
  function moveToFullscreenLayer() {
    const element = options.getElement()
    const parent = element?.parentNode
    if (!element || !parent || fullscreenPlaceholder) {
      return
    }
    fullscreenParent = parent
    fullscreenPlaceholder = document.createComment('data-grid-fullscreen-placeholder')
    parent.insertBefore(fullscreenPlaceholder, element)
    document.body.append(element)
  }

  /** 将全屏表格还原到进入全屏前的组件挂载位置。 */
  function restoreFromFullscreenLayer() {
    const element = options.getElement()
    if (element && fullscreenParent && fullscreenPlaceholder?.parentNode === fullscreenParent) {
      fullscreenParent.insertBefore(element, fullscreenPlaceholder)
      fullscreenPlaceholder.remove()
    }
    fullscreenPlaceholder = undefined
    fullscreenParent = undefined
  }

  function enterFullscreen(source: DataGridFullscreenChangeSource = 'api') {
    if (fullscreen.value) {
      return
    }
    activeFullscreen?.exit()
    activeFullscreen = controller
    previousBodyOverflow = document.body.style.overflow
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    moveToFullscreenLayer()
    fullscreen.value = true
    options.onChange(true, source)
    focusFullscreenTable()
    refreshLayout()
  }

  function exitFullscreen(source: DataGridFullscreenChangeSource = 'api', notify = true) {
    if (!fullscreen.value) {
      return
    }
    fullscreen.value = false
    restoreFromFullscreenLayer()
    if (activeFullscreen === controller) {
      activeFullscreen = undefined
    }
    document.body.style.overflow = previousBodyOverflow
    if (notify) {
      options.onChange(false, source)
    }
    refreshLayout()
    const focusTarget = previousFocus
    previousFocus = null
    void nextTick(() => {
      if (focusTarget?.isConnected) {
        focusTarget.focus({ preventScroll: true })
      }
    })
  }

  function toggleFullscreen(source: DataGridFullscreenChangeSource = 'api') {
    if (fullscreen.value) {
      exitFullscreen(source)
      return
    }
    enterFullscreen(source)
  }

  function isFullscreen() {
    return fullscreen.value
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (
      !fullscreen.value ||
      event.key !== 'Escape' ||
      event.defaultPrevented ||
      options.shouldKeepFullscreenOnEscape()
    ) {
      return
    }
    event.preventDefault()
    exitFullscreen('keyboard')
  }

  onMounted(() => {
    disposed = false
    window.addEventListener('keydown', onDocumentKeydown)
  })

  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('keydown', onDocumentKeydown)
    exitFullscreen('api', false)
    if (layoutFrameId !== undefined) {
      window.cancelAnimationFrame(layoutFrameId)
    }
  })

  return {
    fullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isFullscreen,
  }
}
