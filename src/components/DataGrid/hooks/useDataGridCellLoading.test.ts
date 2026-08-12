import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DATA_GRID_CELL_LOADING_MIN_DURATION,
  DATA_GRID_CELL_LOADING_SHOW_DELAY,
  useDataGridCellLoading,
} from './useDataGridCellLoading'

describe('DataGrid cell loading center', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps concurrent tokens active until every token finishes and makes finish idempotent', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    const first = center.startCellLoading(1, 'amount')
    const second = center.startCellLoading(1, 'amount')

    first.finish()
    first.finish()
    expect(center.isCellLoading(1, 'amount')).toBe(true)

    second.finish()
    expect(center.isCellLoading(1, 'amount')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits 120ms before showing a task', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    center.startCellLoading(1, 'amount')

    vi.advanceTimersByTime(DATA_GRID_CELL_LOADING_SHOW_DELAY - 1)
    expect(center.getCellLoadingState(1, 'amount')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(center.getCellLoadingState(1, 'amount')).toMatchObject({
      visible: true,
      type: 'processing',
    })
  })

  it('keeps a visible task on screen for at least 300ms', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    const task = center.startCellLoading(1, 'amount')
    vi.advanceTimersByTime(DATA_GRID_CELL_LOADING_SHOW_DELAY)
    vi.advanceTimersByTime(50)
    task.finish()

    expect(center.isCellLoading(1, 'amount')).toBe(false)
    expect(center.getCellLoadingState(1, 'amount')).toBeDefined()
    vi.advanceTimersByTime(DATA_GRID_CELL_LOADING_MIN_DURATION - 51)
    expect(center.getCellLoadingState(1, 'amount')).toBeDefined()

    vi.advanceTimersByTime(1)
    expect(center.getCellLoadingState(1, 'amount')).toBeUndefined()
  })

  it('hides validation immediately after the async task finishes', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    const task = center.startCellLoading(1, 'amount', { type: 'validation' })
    vi.advanceTimersByTime(DATA_GRID_CELL_LOADING_SHOW_DELAY)

    expect(center.getCellLoadingState(1, 'amount')).toBeDefined()
    task.finish()

    expect(center.getCellLoadingState(1, 'amount')).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses processing over saving, validation and custom for the rendered state', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    center.startCellLoading(1, 'amount', { type: 'custom' })
    center.startCellLoading(1, 'amount', { type: 'validation' })
    const saving = center.startCellLoading(1, 'amount', { type: 'saving', text: '保存价格' })
    const processing = center.startCellLoading(1, 'amount', {
      type: 'processing',
      text: '重新计算',
    })
    vi.advanceTimersByTime(DATA_GRID_CELL_LOADING_SHOW_DELAY)

    expect(center.getCellLoadingState(1, 'amount')).toMatchObject({
      type: 'processing',
      text: '重新计算',
    })
    processing.finish()
    expect(center.getCellLoadingState(1, 'amount')).toMatchObject({
      type: 'saving',
      text: '保存价格',
    })
    saving.finish()
    expect(center.getCellLoadingState(1, 'amount')).toMatchObject({ type: 'validation' })
  })

  it('blocks interaction by default but allows explicitly non-blocking tasks', () => {
    const center = useDataGridCellLoading({ onChange: () => undefined })
    const backgroundTask = center.startCellLoading(1, 'name', { blockInteraction: false })
    expect(center.isCellInteractionBlocked(1, 'name')).toBe(false)

    const blockingTask = center.startCellLoading(1, 'name')
    expect(center.isCellInteractionBlocked(1, 'name')).toBe(true)
    blockingTask.finish()
    expect(center.isCellInteractionBlocked(1, 'name')).toBe(false)
    backgroundTask.finish()
  })

  it('clears tasks and timers when its owning scope is disposed', () => {
    const scope = effectScope()
    const center = scope.run(() => useDataGridCellLoading({ onChange: () => undefined }))!
    center.startCellLoading(1, 'name')
    expect(vi.getTimerCount()).toBe(1)

    scope.stop()
    expect(center.isCellLoading(1, 'name')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
