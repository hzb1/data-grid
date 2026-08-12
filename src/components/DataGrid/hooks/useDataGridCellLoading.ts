/**
 * 组合函数名称：DataGrid 单元格 Loading 中心
 * 使用场景：统一管理业务处理、保存和异步校验的单元格任务、展示节奏与生命周期清理。
 */

import { getCurrentScope, onScopeDispose } from 'vue'
import type {
  DataGridCellLoadingOptions,
  DataGridCellLoadingRenderState,
  DataGridCellLoadingTask,
  DataGridCellLoadingType,
  DataGridRowKey,
} from '../types'

/** Loading 首次展示前的固定等待时间，单位为毫秒。 */
export const DATA_GRID_CELL_LOADING_SHOW_DELAY = 120

/** Loading 一旦可见后的最短展示时间，单位为毫秒。 */
export const DATA_GRID_CELL_LOADING_MIN_DURATION = 300

/** 校验 Loading 完成后不额外停留，避免遮盖已经返回的校验结果。 */
const DATA_GRID_VALIDATION_LOADING_MIN_DURATION = 0

/** 各类单元格 Loading 的展示优先级。 */
const DATA_GRID_CELL_LOADING_PRIORITY: Record<DataGridCellLoadingType, number> = {
  processing: 40,
  saving: 30,
  validation: 20,
  custom: 10,
}

/** Loading Center 内部保存的单个任务。 */
interface DataGridInternalCellLoadingTask {
  /** 当前任务的唯一标识。 */
  id: symbol

  /** 当前任务的启动顺序，用于同优先级任务的稳定选择。 */
  sequence: number

  /** 当前任务归一化后的展示和交互选项。 */
  options: Required<Pick<DataGridCellLoadingOptions, 'type' | 'blockInteraction'>> &
    Pick<DataGridCellLoadingOptions, 'text'>
}

/** Loading Center 内部保存的单元格状态。 */
interface DataGridInternalCellLoadingState {
  /** 当前单元格仍未完成的全部任务。 */
  tasks: Map<symbol, DataGridInternalCellLoadingTask>

  /** 当前单元格的 Loading 是否已经进入可见阶段。 */
  visible: boolean

  /** 当前可见阶段开始的时间戳。 */
  visibleAt?: number

  /** 当前可见阶段采用的展示状态。 */
  renderState?: DataGridCellLoadingRenderState

  /** 延迟展示使用的计时器。 */
  showTimer?: ReturnType<typeof setTimeout>

  /** 保证最短展示时间使用的计时器。 */
  hideTimer?: ReturnType<typeof setTimeout>
}

/** DataGrid 单元格 Loading 中心配置。 */
interface UseDataGridCellLoadingOptions {
  /** 单元格 Loading 展示状态变化后通知表格刷新。 */
  onChange: (rowKey: DataGridRowKey, field: string) => void

  /** 返回当前时间戳，测试可替换为受控时钟。 */
  now?: () => number
}

/** 返回任务类型对应的默认提示文字。 */
function getDefaultLoadingText(type: DataGridCellLoadingType) {
  if (type === 'validation') return '校验中'
  if (type === 'saving') return '保存中'
  if (type === 'custom') return '加载中'
  return '处理中'
}

/** 管理 DataGrid 实例内全部单元格 Loading 任务。 */
export function useDataGridCellLoading(options: UseDataGridCellLoadingOptions) {
  const cellMap = new Map<DataGridRowKey, Map<string, DataGridInternalCellLoadingState>>()
  const now = options.now ?? Date.now
  let taskSequence = 0

  function getCellState(rowKey: DataGridRowKey, field: string) {
    return cellMap.get(rowKey)?.get(field)
  }

  function getOrCreateCellState(rowKey: DataGridRowKey, field: string) {
    const fieldMap = cellMap.get(rowKey) ?? new Map<string, DataGridInternalCellLoadingState>()
    if (!cellMap.has(rowKey)) {
      cellMap.set(rowKey, fieldMap)
    }
    const state = fieldMap.get(field) ?? {
      tasks: new Map<symbol, DataGridInternalCellLoadingTask>(),
      visible: false,
    }
    if (!fieldMap.has(field)) {
      fieldMap.set(field, state)
    }
    return state
  }

  function getDominantTask(state: DataGridInternalCellLoadingState) {
    return [...state.tasks.values()].sort(
      (left, right) =>
        DATA_GRID_CELL_LOADING_PRIORITY[right.options.type] -
          DATA_GRID_CELL_LOADING_PRIORITY[left.options.type] || right.sequence - left.sequence,
    )[0]
  }

  function updateRenderState(state: DataGridInternalCellLoadingState) {
    const task = getDominantTask(state)
    if (!task) {
      return
    }
    state.renderState = {
      visible: state.visible,
      type: task.options.type,
      text: task.options.text ?? getDefaultLoadingText(task.options.type),
      blockInteraction: [...state.tasks.values()].some((item) => item.options.blockInteraction),
    }
  }

  function removeCellState(rowKey: DataGridRowKey, field: string) {
    const fieldMap = cellMap.get(rowKey)
    const state = fieldMap?.get(field)
    if (!fieldMap || !state) {
      return
    }
    if (state.showTimer) clearTimeout(state.showTimer)
    if (state.hideTimer) clearTimeout(state.hideTimer)
    fieldMap.delete(field)
    if (!fieldMap.size) {
      cellMap.delete(rowKey)
    }
    options.onChange(rowKey, field)
  }

  function showCellLoading(
    rowKey: DataGridRowKey,
    field: string,
    state: DataGridInternalCellLoadingState,
  ) {
    state.showTimer = undefined
    if (!state.tasks.size || getCellState(rowKey, field) !== state) {
      return
    }
    state.visible = true
    state.visibleAt = now()
    updateRenderState(state)
    options.onChange(rowKey, field)
  }

  function finishTask(rowKey: DataGridRowKey, field: string, taskId: symbol) {
    const state = getCellState(rowKey, field)
    if (!state?.tasks.delete(taskId)) {
      return
    }
    if (state.tasks.size) {
      updateRenderState(state)
      if (state.visible) options.onChange(rowKey, field)
      return
    }
    if (!state.visible) {
      removeCellState(rowKey, field)
      return
    }
    const minDuration =
      state.renderState?.type === 'validation'
        ? DATA_GRID_VALIDATION_LOADING_MIN_DURATION
        : DATA_GRID_CELL_LOADING_MIN_DURATION
    const remainingDuration = Math.max(0, minDuration - (now() - (state.visibleAt ?? now())))
    if (!remainingDuration) {
      removeCellState(rowKey, field)
      return
    }
    state.hideTimer = setTimeout(() => removeCellState(rowKey, field), remainingDuration)
  }

  function startCellLoading(
    rowKey: DataGridRowKey,
    field: string,
    loadingOptions: DataGridCellLoadingOptions = {},
  ): DataGridCellLoadingTask {
    const state = getOrCreateCellState(rowKey, field)
    if (state.hideTimer) {
      clearTimeout(state.hideTimer)
      state.hideTimer = undefined
    }
    const taskId = Symbol('data-grid-cell-loading')
    state.tasks.set(taskId, {
      id: taskId,
      sequence: ++taskSequence,
      options: {
        type: loadingOptions.type ?? 'processing',
        text: loadingOptions.text,
        blockInteraction: loadingOptions.blockInteraction ?? true,
      },
    })
    updateRenderState(state)
    if (state.visible) {
      options.onChange(rowKey, field)
    } else if (!state.showTimer) {
      state.showTimer = setTimeout(
        () => showCellLoading(rowKey, field, state),
        DATA_GRID_CELL_LOADING_SHOW_DELAY,
      )
    }
    let finished = false
    return {
      finish() {
        if (finished) return
        finished = true
        finishTask(rowKey, field, taskId)
      },
    }
  }

  function isCellLoading(rowKey: DataGridRowKey, field: string) {
    return Boolean(getCellState(rowKey, field)?.tasks.size)
  }

  function isCellInteractionBlocked(rowKey: DataGridRowKey, field: string) {
    const state = getCellState(rowKey, field)
    return Boolean(state && [...state.tasks.values()].some((task) => task.options.blockInteraction))
  }

  function getCellLoadingState(rowKey: DataGridRowKey, field: string) {
    const state = getCellState(rowKey, field)
    return state?.visible ? state.renderState : undefined
  }

  function clearCellLoading(rowKey?: DataGridRowKey, field?: string) {
    if (rowKey !== undefined) {
      if (field !== undefined) {
        removeCellState(rowKey, field)
        return
      }
      const fields = [...(cellMap.get(rowKey)?.keys() ?? [])]
      fields.forEach((currentField) => removeCellState(rowKey, currentField))
      return
    }
    const targets = [...cellMap.entries()].flatMap(([currentRowKey, fields]) =>
      [...fields.keys()].map((currentField) => [currentRowKey, currentField] as const),
    )
    targets.forEach(([currentRowKey, currentField]) => removeCellState(currentRowKey, currentField))
  }

  function prune(activeRowKeys: Set<DataGridRowKey>, activeFields: Set<string>) {
    const targets = [...cellMap.entries()].flatMap(([rowKey, fields]) =>
      [...fields.keys()]
        .filter((field) => !activeRowKeys.has(rowKey) || !activeFields.has(field))
        .map((field) => [rowKey, field] as const),
    )
    targets.forEach(([rowKey, field]) => removeCellState(rowKey, field))
  }

  if (getCurrentScope()) {
    onScopeDispose(() => clearCellLoading())
  }

  return {
    clearCellLoading,
    getCellLoadingState,
    isCellInteractionBlocked,
    isCellLoading,
    prune,
    startCellLoading,
  }
}
