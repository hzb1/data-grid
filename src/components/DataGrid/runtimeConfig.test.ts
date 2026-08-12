// @vitest-environment jsdom

/**
 * DataGrid 运行时配置测试。
 * 验证宿主能力按 Vue 应用隔离，并确认默认 localStorage 驱动的物理键协议。
 */

import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DataGridMessageAdapter } from './message'
import { createDataGridLocalStorageDriver } from './repository/storageDriver'
import type { DataGridColumnSettingStorageDriver } from './repository/types'
import {
  DataGridPlugin,
  type DataGridRuntimeConfig,
  useDataGridRuntimeConfig,
} from './runtimeConfig'

function createMessageAdapter(): DataGridMessageAdapter {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }
}

describe('DataGrid runtime config', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('isolates injected host capabilities between Vue applications', () => {
    const observedConfigs: DataGridRuntimeConfig[] = []
    const Probe = defineComponent({
      name: 'DataGridRuntimeConfigProbe',
      setup() {
        observedConfigs.push(useDataGridRuntimeConfig())
        return () => h('div')
      },
    })
    const firstMessageAdapter = createMessageAdapter()
    const secondMessageAdapter = createMessageAdapter()
    const storageDriver: DataGridColumnSettingStorageDriver = {
      get: vi.fn(() => null),
      set: vi.fn(),
      remove: vi.fn(),
      keys: vi.fn(() => []),
    }
    const resolvePersistenceScope = () => ({ tenantId: 'tenant-a', userId: 'user-a' })

    mount(Probe, {
      global: {
        plugins: [
          [
            DataGridPlugin,
            { storageDriver, resolvePersistenceScope, messageAdapter: firstMessageAdapter },
          ],
        ],
      },
    })
    mount(Probe, {
      global: {
        plugins: [[DataGridPlugin, { messageAdapter: secondMessageAdapter }]],
      },
    })

    expect(observedConfigs[0]).toMatchObject({
      storageDriver,
      resolvePersistenceScope,
      messageAdapter: firstMessageAdapter,
    })
    expect(observedConfigs[1]?.messageAdapter).toBe(secondMessageAdapter)
    expect(observedConfigs[1]?.messageAdapter).not.toBe(firstMessageAdapter)
  })

  it('keeps logical keys behind the configured localStorage prefix', () => {
    const driver = createDataGridLocalStorageDriver('custom-prefix/')

    driver.set('data-grid:columns:tenant:user:orders', '{"version":1}')
    driver.set('another-namespace:key', 'ignored')

    expect(localStorage.getItem('custom-prefix/data-grid:columns:tenant:user:orders')).toBe(
      '{"version":1}',
    )
    expect(driver.get('data-grid:columns:tenant:user:orders')).toBe('{"version":1}')
    expect(driver.keys('data-grid:columns:')).toEqual(['data-grid:columns:tenant:user:orders'])

    driver.remove('data-grid:columns:tenant:user:orders')
    expect(driver.get('data-grid:columns:tenant:user:orders')).toBeNull()
  })
})
