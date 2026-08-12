/**
 * 工具名称：DataGrid 开发诊断
 * 使用场景：统一管理 DataGrid 潜在配置问题的分级输出、去重和诊断事件。
 */

import type {
  DataGridDiagnostic,
  DataGridDiagnosticLevel,
  DataGridDiagnosticsConfig,
} from './types'

/** DataGrid 内部待报告的诊断信息。 */
export interface DataGridDiagnosticInput extends DataGridDiagnostic {
  /** 同一诊断编码下用于区分具体问题的稳定标识。 */
  dedupeKey?: string
}

/** DataGrid 诊断管理器的创建参数。 */
interface CreateDataGridDiagnosticsOptions {
  /** 返回当前组件的诊断配置。 */
  getConfig: () => boolean | DataGridDiagnosticsConfig | undefined

  /** 诊断满足输出条件时触发的回调。 */
  onDiagnostic: (diagnostic: DataGridDiagnostic) => void
}

/** DataGrid 诊断级别对应的过滤权重。 */
const DATA_GRID_DIAGNOSTIC_LEVEL_WEIGHT: Record<DataGridDiagnosticLevel, number> = {
  info: 1,
  warning: 2,
  error: 3,
}

/** 将未知异常转换成适合开发定位的简短文本。 */
export function getDataGridDiagnosticErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** 创建单个 DataGrid 实例使用的开发诊断管理器。 */
export function createDataGridDiagnostics(options: CreateDataGridDiagnosticsOptions) {
  let activeStaticKeys = new Set<string>()
  let staticConfigKey = ''
  const reportedRuntimeKeys = new Set<string>()

  function resolveConfig() {
    const config = options.getConfig()
    if (config === false) {
      return
    }
    if (config === undefined && !import.meta.env.DEV) {
      return
    }
    if (typeof config === 'object' && config.enabled === false) {
      return
    }
    return typeof config === 'object' ? config : {}
  }

  /** 返回当前 DataGrid 实例是否启用了诊断模式。 */
  function isEnabled() {
    return Boolean(resolveConfig())
  }

  function getDiagnosticKey(diagnostic: DataGridDiagnosticInput) {
    return `${diagnostic.code}:${diagnostic.dedupeKey || diagnostic.message}`
  }

  function output(diagnostic: DataGridDiagnosticInput) {
    const config = resolveConfig()
    if (!config) {
      return false
    }
    const minimumLevel = config.level ?? 'warning'
    if (
      DATA_GRID_DIAGNOSTIC_LEVEL_WEIGHT[diagnostic.level] <
      DATA_GRID_DIAGNOSTIC_LEVEL_WEIGHT[minimumLevel]
    ) {
      return false
    }
    const tableName = config.name ? `“${config.name}”` : '当前表格'
    const title = `[DataGrid][${diagnostic.code}][${diagnostic.level}] ${tableName}${diagnostic.message}`
    const message = diagnostic.suggestion ? `${title}\n建议：${diagnostic.suggestion}` : title
    const publicDiagnostic: DataGridDiagnostic = {
      code: diagnostic.code,
      level: diagnostic.level,
      message: diagnostic.message,
      suggestion: diagnostic.suggestion,
      context: diagnostic.context,
    }
    const context = config.includeContext === false ? undefined : diagnostic.context
    if (diagnostic.level === 'error' && context) {
      globalThis.console.error(message, context)
    } else if (diagnostic.level === 'error') {
      globalThis.console.error(message)
    } else if (diagnostic.level === 'warning' && context) {
      globalThis.console.warn(message, context)
    } else if (diagnostic.level === 'warning') {
      globalThis.console.warn(message)
    } else if (context) {
      globalThis.console.info(message, context)
    } else {
      globalThis.console.info(message)
    }
    options.onDiagnostic(publicDiagnostic)
    return true
  }

  /** 同步当前静态诊断；问题消失后再次出现时允许重新输出。 */
  function sync(diagnostics: DataGridDiagnosticInput[]) {
    const config = resolveConfig()
    if (!config) {
      activeStaticKeys.clear()
      staticConfigKey = ''
      return
    }
    const nextConfigKey = JSON.stringify({
      level: config.level ?? 'warning',
      name: config.name ?? '',
      includeContext: config.includeContext !== false,
    })
    if (nextConfigKey !== staticConfigKey) {
      activeStaticKeys.clear()
      staticConfigKey = nextConfigKey
    }
    const nextKeys = new Set(diagnostics.map(getDiagnosticKey))
    const outputKeys = new Set<string>()
    diagnostics.forEach((diagnostic) => {
      const key = getDiagnosticKey(diagnostic)
      if (!activeStaticKeys.has(key) && !outputKeys.has(key)) {
        output(diagnostic)
        outputKeys.add(key)
      }
    })
    activeStaticKeys = nextKeys
  }

  /** 报告一次运行时诊断，同一实例和去重标识只输出一次。 */
  function report(diagnostic: DataGridDiagnosticInput) {
    if (!resolveConfig()) {
      return
    }
    const key = getDiagnosticKey(diagnostic)
    if (reportedRuntimeKeys.has(key)) {
      return
    }
    if (output(diagnostic)) {
      reportedRuntimeKeys.add(key)
    }
  }

  return {
    isEnabled,
    sync,
    report,
  }
}
