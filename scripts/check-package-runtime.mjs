#!/usr/bin/env node

/**
 * 脚本名称：DataGrid 发布产物运行时检查
 * 使用场景：在发布前验证 ESM 入口、公共导出、样式产物和 npm bin 基础协议。
 */

import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entryPath = resolve(projectRoot, 'dist/index.js')
const declarationPath = resolve(projectRoot, 'dist/index.d.ts')
const stylePath = resolve(projectRoot, 'dist/style.css')
const rowKeyBinPath = resolve(projectRoot, 'scripts/check-data-grid-row-key.mjs')

async function assertNonEmptyFile(path, label) {
  const fileStat = await stat(path)
  if (!fileStat.isFile() || fileStat.size === 0) {
    throw new Error(`${label}不存在或内容为空：${path}`)
  }
}

await Promise.all([
  assertNonEmptyFile(entryPath, 'ESM 入口'),
  assertNonEmptyFile(declarationPath, '类型声明'),
  assertNonEmptyFile(stylePath, '样式产物'),
  assertNonEmptyFile(rowKeyBinPath, 'rowKey 命令'),
])

const publicApi = await import(pathToFileURL(entryPath).href)
const requiredExports = [
  'DataGrid',
  'DataGridPlugin',
  'createDataGridLocalStorageDriver',
  'createDataGridRowKey',
  'dataGridClipboardParsers',
]
const missingExports = requiredExports.filter((exportName) => !(exportName in publicApi))
if (missingExports.length) {
  throw new Error(`ESM 入口缺少公共导出：${missingExports.join('、')}`)
}

const styleSource = await readFile(stylePath, 'utf8')
if (!styleSource.includes('.data-grid') || !styleSource.includes('.ag-theme-quartz')) {
  throw new Error('样式产物未同时包含 DataGrid 和 AG Grid 主题样式。')
}

const rowKeyBinSource = await readFile(rowKeyBinPath, 'utf8')
if (!rowKeyBinSource.startsWith('#!/usr/bin/env node')) {
  throw new Error('rowKey 命令缺少 Node.js shebang。')
}

console.log('DataGrid 发布产物运行时检查通过。')
