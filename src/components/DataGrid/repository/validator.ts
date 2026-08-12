import { parseDataGridColumnSettingOverrides } from '../columnSetting'
import type { DataGridColumnSettingCache } from './types'

/** 判断未知值是否为可读取属性的普通对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** 从未知值中读取缓存结构版本，用于区分版本不兼容和结构损坏。 */
export function getDataGridColumnSettingCacheVersion(value: unknown) {
  return isRecord(value) ? value.version : undefined
}

/** 将未知值解析并校验为当前 DataGrid 列配置缓存。 */
export function parseDataGridColumnSettingCache(
  value: unknown,
): DataGridColumnSettingCache | undefined {
  if (!isRecord(value) || !isRecord(value.data)) {
    return
  }
  if (
    !Number.isInteger(value.version) ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    value.createdAt <= 0 ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt) ||
    value.updatedAt <= 0 ||
    typeof value.lastAccessAt !== 'number' ||
    !Number.isFinite(value.lastAccessAt) ||
    value.lastAccessAt <= 0
  ) {
    return
  }
  const overrides = parseDataGridColumnSettingOverrides(value.data.overrides)
  if (!overrides) {
    return
  }
  return {
    version: value.version as number,
    revision: value.revision as number,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    lastAccessAt: value.lastAccessAt,
    data: { overrides },
  }
}
