#!/usr/bin/env node

/**
 * 脚本名称：DataGrid rowKey 构建门禁
 * 使用场景：在构建前检查启用强依赖功能的 Vue 模板是否显式声明有效 row-key。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseParse, NodeTypes } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'

/** 返回表达式去除首尾空白后的内容。 */
function normalizeExpression(value) {
  return value?.trim() ?? ''
}

/** 返回模板节点上的普通属性或指令名称。 */
function getAttributeName(attribute) {
  if (attribute.type === NodeTypes.ATTRIBUTE) {
    return attribute.name
  }
  return attribute.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? attribute.arg.content : undefined
}

/** 返回绑定指令的表达式文本。 */
function getBindingExpression(attribute) {
  return attribute.type === NodeTypes.DIRECTIVE ? attribute.exp?.content : undefined
}

/** 判断 DataGrid 是否显式声明了可用的 row-key。 */
function hasExplicitRowKey(attributes) {
  const attribute = attributes.find((item) => getAttributeName(item) === 'row-key')
  if (!attribute) {
    return false
  }
  if (attribute.type === NodeTypes.ATTRIBUTE) {
    return Boolean(attribute.value?.content.trim())
  }
  if (attribute.name !== 'bind') {
    return false
  }
  const expression = normalizeExpression(getBindingExpression(attribute))
  return Boolean(expression) && !['undefined', 'null', 'false', "''", '""'].includes(expression)
}

/** 收集当前 DataGrid 节点启用的强依赖行标识功能。 */
function collectStrongDependencyReasons(attributes) {
  const reasons = []
  attributes.forEach((attribute) => {
    const name = getAttributeName(attribute)
    if (name === 'selected-row-keys') {
      reasons.push('受控选择')
      return
    }
    if (name === 'row-selection' && attribute.type === NodeTypes.DIRECTIVE) {
      const expression = normalizeExpression(getBindingExpression(attribute))
      if (/\breserveSelection\s*:\s*true\b/.test(expression)) {
        reasons.push('跨数据保留选择')
      }
    }
  })
  return [...new Set(reasons)]
}

/** 检查单个 Vue 文件源码中的 DataGrid rowKey 违规项。 */
export function findDataGridRowKeyViolations(source, filename = 'anonymous.vue') {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length || !descriptor.template) {
    return []
  }
  const template = descriptor.template
  const ast = baseParse(template.content, { onError: () => undefined })
  const violations = []

  function visit(node) {
    if (node.type === NodeTypes.ELEMENT) {
      if (node.tag === 'DataGrid' || node.tag === 'data-grid') {
        const reasons = collectStrongDependencyReasons(node.props)
        if (reasons.length && !hasExplicitRowKey(node.props)) {
          violations.push({
            filename,
            line: template.loc.start.line + node.loc.start.line - 1,
            reasons,
          })
        }
      }
      node.children.forEach(visit)
      return
    }
    if (node.type === NodeTypes.ROOT) {
      node.children.forEach(visit)
    }
  }

  visit(ast)
  return violations
}

/** 递归返回目录中的全部 Vue 文件。 */
function collectVueFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory()
      ? collectVueFiles(path)
      : path.endsWith('.vue')
        ? [path]
        : []
  })
}

/** 执行项目级 DataGrid rowKey 构建门禁。 */
export function checkDataGridRowKeys(sourceRoot = resolve(process.cwd(), 'src')) {
  return collectVueFiles(sourceRoot).flatMap((filename) =>
    findDataGridRowKeyViolations(readFileSync(filename, 'utf8'), relative(process.cwd(), filename)),
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceRoot = resolve(process.cwd(), process.argv[2] ?? 'src')
  const violations = checkDataGridRowKeys(sourceRoot)
  if (violations.length) {
    console.error('DataGrid rowKey 构建门禁失败：以下强依赖表格必须显式声明有效 row-key。')
    violations.forEach((violation) => {
      console.error(`- ${violation.filename}:${violation.line}（${violation.reasons.join('、')}）`)
    })
    process.exitCode = 1
  } else {
    console.log('DataGrid rowKey 构建门禁通过。')
  }
}
