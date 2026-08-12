/** DataGrid 演示站场景注册、代码展示与导航使用的公共类型。 */

import type { Component } from 'vue'

/**
 * 首版演示站支持的场景标识。
 *
 * - `basic`：基础展示、排序、固定列和汇总。
 * - `filter-selection`：表头筛选与多行选择。
 * - `edit-validation`：数据编辑、派生计算和业务校验。
 */
export type DemoId = 'basic' | 'filter-selection' | 'edit-validation'

/**
 * 演示场景的学习阶段。
 *
 * - `入门`：帮助用户理解最小可用配置。
 * - `交互`：展示筛选、选择等用户操作。
 * - `业务`：展示编辑、计算与业务规则闭环。
 */
export type DemoLevel = '入门' | '交互' | '业务'

/** 演示卡片中的单个代码标签页。 */
export interface DemoCodeTab {
  /** 标签页稳定标识。 */
  id: 'complete' | 'config' | 'model'

  /** 标签页按钮展示名称。 */
  label: string

  /** 代码内容所属语言，用于辅助说明与后续语法高亮扩展。 */
  language: 'vue' | 'typescript'

  /** 标签页展示并可复制的源码。 */
  source: string
}

/** 注册表中的完整演示场景定义。 */
export interface DemoDefinition {
  /** 场景稳定标识，同时用于页面锚点和独立预览参数。 */
  id: DemoId

  /** 场景标题。 */
  title: string

  /** 右侧目录使用的简短名称。 */
  navLabel: string

  /** 场景所属学习阶段。 */
  level: DemoLevel

  /** 当前场景解决的问题或主要能力。 */
  description: string

  /** 引导用户动手体验的操作说明。 */
  hint: string

  /** 当前场景直接使用的 DataGrid 公共 API 名称。 */
  apiNames: string[]

  /** 用于后续检索与分类的场景关键词。 */
  keywords: string[]

  /** 负责渲染真实 DataGrid 的 Vue 场景组件。 */
  component: Component

  /** 懒挂载前预留的最小高度，单位为像素。 */
  minHeight: number

  /** 是否作为首屏场景立即挂载。 */
  eager: boolean

  /** 由真实源码与共享片段生成的代码标签页。 */
  codeTabs: DemoCodeTab[]
}

/** 演示站目录中的单个锚点。 */
export interface DemoNavItem {
  /** 锚点对应的页面元素标识。 */
  id: string

  /** 目录中展示的场景名称。 */
  label: string
}

/** 演示站目录中的能力分组。 */
export interface DemoNavGroup {
  /** 分组标题。 */
  label: string

  /** 当前分组包含的演示锚点。 */
  items: DemoNavItem[]
}
