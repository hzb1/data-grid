import { describe, expect, it } from 'vitest'
// @ts-expect-error 构建门禁以 Node.js ESM 脚本发布，不参与业务 TypeScript 声明生成。
import { findDataGridRowKeyViolations } from '../../../scripts/check-data-grid-row-key.mjs'

/** 将单个 DataGrid 模板包装成完整 Vue 单文件组件。 */
function createVueSource(tableTemplate: string) {
  return `<template>${tableTemplate}</template>`
}

describe('DataGrid rowKey build check', () => {
  it.each([
    '<DataGrid v-model:selected-row-keys="keys" />',
    '<DataGrid :selected-row-keys="keys" />',
    '<DataGrid :row-selection="{ mode: \'multiple\', reserveSelection: true }" />',
  ])('拦截未配置 row-key 的强依赖模板：%s', (template) => {
    expect(findDataGridRowKeyViolations(createVueSource(template))).toHaveLength(1)
  })

  it.each([
    '<DataGrid />',
    '<DataGrid mode="edit" />',
    '<DataGrid :mode="mode" />',
    '<DataGrid mode="view" />',
    '<DataGrid :mode="\'view\'" />',
    '<DataGrid row-selection />',
    '<DataGrid :row-selection="selection" />',
    '<DataGrid :row-selection="{ mode: \'multiple\' }" />',
    '<DataGrid :row-selection="{ reserveSelection: false }" />',
    '<DataGrid :row-selection="false" />',
    '<DataGrid validation />',
    '<DataGrid :validation="false" />',
    '<DataGrid :row-rules="rules" />',
    '<DataGrid :row-rules="[]" />',
    '<DataGrid :process-row-change="processRow" />',
    '<DataGrid mode="edit" row-key="id" />',
    '<DataGrid :row-selection="selection" :row-key="resolveRowKey" />',
  ])('允许弱依赖或已声明有效 row-key 的模板：%s', (template) => {
    expect(findDataGridRowKeyViolations(createVueSource(template))).toHaveLength(0)
  })

  it.each([
    '<DataGrid v-model:selected-row-keys="keys" row-key />',
    '<DataGrid v-model:selected-row-keys="keys" row-key="" />',
    '<DataGrid v-model:selected-row-keys="keys" :row-key="undefined" />',
    '<DataGrid v-model:selected-row-keys="keys" :row-key="null" />',
  ])('拦截空 row-key：%s', (template) => {
    expect(findDataGridRowKeyViolations(createVueSource(template))).toHaveLength(1)
  })
})
