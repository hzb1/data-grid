/**
 * 工具名称：DataGrid 诊断规则
 * 使用场景：以纯函数检查 DataGrid 列、选项、功能配置和行标识中的潜在问题。
 */

import { getDataGridFilterOperators } from './filter'
import { getColumnOptions } from './options'
import { encodeDataGridRowKey, isDataGridRowKey, type DataGridRowKeyIssue } from './rowKey'
import type { DataGridDiagnosticInput } from './diagnostics'
import type {
  DataGridColumn,
  DataGridFilterOperator,
  DataGridMode,
  DataGridRow,
  DataGridRowKey,
  DataGridRowSelectionConfig,
  DataGridValidationConfig,
  DataGridClipboardConfig,
  DataGridHistoryConfig,
  DataGridRowDragConfig,
  DataGridColumnSettingConfig,
} from './types'

/** DataGrid 静态诊断需要检查的组件配置。 */
interface DataGridStaticDiagnosticOptions<Row extends DataGridRow> {
  /** 当前业务列配置。 */
  columns: DataGridColumn<Row>[]

  /** 当前组件声明的插槽名称。 */
  slotNames: string[]

  /** 当前表格交互模式。 */
  mode: DataGridMode

  /** 当前剪贴板配置。 */
  clipboard: false | DataGridClipboardConfig<Row>

  /** 当前校验配置。 */
  validation: false | DataGridValidationConfig | undefined

  /** 当前是否配置行级校验规则。 */
  hasRowRules: boolean

  /** 当前历史记录配置。 */
  history: false | DataGridHistoryConfig

  /** 当前行拖动配置。 */
  rowDrag: false | DataGridRowDragConfig<Row>

  /** 当前行选择配置。 */
  rowSelection: false | DataGridRowSelectionConfig<Row>

  /** 当前用户级列配置。 */
  columnSetting: false | DataGridColumnSettingConfig
}

/** DataGrid 行标识诊断需要检查的数据。 */
interface DataGridRowDiagnosticOptions<Row extends DataGridRow> {
  /** 当前受控行数据。 */
  rows: Row[]

  /** 当前 selectedRowKeys 外部状态。 */
  selectedRowKeys: DataGridRowKey[]

  /** 解析指定行的实际行标识。 */
  getRowKey: (row: Row, dataIndex: number) => DataGridRowKey

  /** 当前业务行标识解析和去重产生的问题。 */
  rowKeyIssues: DataGridRowKeyIssue[]

  /** 当前数据中使用组件私有临时身份的行数。 */
  generatedRowKeyCount: number

  /** 业务页面是否显式声明了 rowKey。 */
  hasExplicitRowKey: boolean

  /** 当前是否启用了依赖稳定行标识的状态型能力。 */
  requiresStableRowKey: boolean
}

/** 判断列数值尺寸是否为有效正数。 */
function isInvalidPositiveNumber(value: number | undefined) {
  return value !== undefined && (!Number.isFinite(value) || value <= 0)
}

/** 收集列及表级功能配置中的高确定性诊断。 */
export function collectDataGridStaticDiagnostics<Row extends DataGridRow>(
  options: DataGridStaticDiagnosticOptions<Row>,
) {
  const diagnostics: DataGridDiagnosticInput[] = []
  const fieldIndexes = new Map<string, number[]>()

  if (!options.columns.length) {
    diagnostics.push({
      code: 'DG-COLUMN-001',
      level: 'warning',
      message: '没有配置任何业务列，表格只能显示空状态。',
      suggestion: '至少提供一个包含 field 和 title 的 DataGridColumn。',
    })
  }

  options.columns.forEach((column, index) => {
    const field = String(column.field)
    const indexes = fieldIndexes.get(field) || []
    indexes.push(index)
    fieldIndexes.set(field, indexes)

    if (!field.trim()) {
      diagnostics.push({
        code: 'DG-COLUMN-002',
        level: 'error',
        message: `第 ${index + 1} 列的 field 为空，列状态和数据访问可能失效。`,
        suggestion: '为每一列提供非空且唯一的 field。',
        dedupeKey: String(index),
        context: { columnIndex: index },
      })
    }
    if (!String(column.title ?? '').trim()) {
      diagnostics.push({
        code: 'DG-COLUMN-003',
        level: 'warning',
        message: `字段“${field}”没有有效标题，表头和复制表头将为空。`,
        suggestion: '为该列提供非空 title。',
        dedupeKey: field,
        context: { field },
      })
    }
    const invalidSizes = [
      ['width', column.width],
      ['minWidth', column.minWidth],
      ['maxWidth', column.maxWidth],
      ['flex', column.flex],
    ].filter(([, value]) => isInvalidPositiveNumber(value as number | undefined))
    if (invalidSizes.length) {
      diagnostics.push({
        code: 'DG-COLUMN-004',
        level: 'warning',
        message: `字段“${field}”存在无效尺寸：${invalidSizes.map(([name]) => name).join('、')}。`,
        suggestion: '列宽和 flex 必须是大于 0 的有限数字。',
        dedupeKey: field,
        context: { field, properties: invalidSizes.map(([name]) => name) },
      })
    }
    if (
      column.minWidth !== undefined &&
      column.maxWidth !== undefined &&
      column.minWidth > column.maxWidth
    ) {
      diagnostics.push({
        code: 'DG-COLUMN-005',
        level: 'warning',
        message: `字段“${field}”的 minWidth 大于 maxWidth，最终列宽可能不符合预期。`,
        suggestion: '确保 minWidth 小于或等于 maxWidth。',
        dedupeKey: field,
        context: { field, minWidth: column.minWidth, maxWidth: column.maxWidth },
      })
    }

    const filter = column.filter && 'operators' in column.filter ? column.filter : undefined
    const effectiveOperators = getDataGridFilterOperators(
      column as unknown as DataGridColumn,
    ) as DataGridFilterOperator[]
    const configuredOperators = filter?.operators as DataGridFilterOperator[] | undefined
    const invalidOperators =
      configuredOperators?.filter((operator) => !effectiveOperators.includes(operator)) || []
    if (invalidOperators.length) {
      diagnostics.push({
        code: 'DG-FILTER-001',
        level: 'warning',
        message: `字段“${field}”配置了当前 searchType 不支持的筛选操作符，相关配置会被忽略。`,
        suggestion: '根据 searchType 使用受支持的 operators。',
        dedupeKey: field,
        context: { field, searchType: column.searchType, invalidOperators },
      })
    }
    if (filter?.defaultOperator && !effectiveOperators.includes(filter.defaultOperator)) {
      diagnostics.push({
        code: 'DG-FILTER-002',
        level: 'warning',
        message: `字段“${field}”的 defaultOperator 不可用，筛选器会回退到第一个有效操作符。`,
        suggestion: '让 defaultOperator 同时存在于当前列的有效 operators 中。',
        dedupeKey: field,
        context: { field, defaultOperator: filter.defaultOperator },
      })
    }

    const columnOptions = getColumnOptions(column)
    columnOptions.forEach((option, optionIndex) => {
      const duplicateValueIndex = columnOptions.findIndex(
        (candidate, candidateIndex) =>
          candidateIndex < optionIndex && Object.is(candidate.value, option.value),
      )
      if (duplicateValueIndex >= 0) {
        diagnostics.push({
          code: 'DG-OPTION-002',
          level: 'error',
          message: `字段“${field}”的 options 存在重复 value，显示、筛选或粘贴匹配可能不唯一。`,
          suggestion: '确保同一列中每个 option.value 唯一。',
          dedupeKey: field,
          context: { field, optionIndexes: [duplicateValueIndex, optionIndex] },
        })
      }
    })
    const optionTexts = new Map<string, number>()
    columnOptions.forEach((option, optionIndex) => {
      const searchableTexts = [option.label, ...(option.aliases || [])]
      searchableTexts.forEach((text) => {
        const normalizedText = text.trim().toLocaleLowerCase()
        if (!normalizedText) {
          return
        }
        const previousIndex = optionTexts.get(normalizedText)
        if (previousIndex !== undefined && previousIndex !== optionIndex) {
          diagnostics.push({
            code: 'DG-OPTION-003',
            level: 'warning',
            message: `字段“${field}”的选项文本“${text}”可匹配多个 value，粘贴时会失败。`,
            suggestion: '确保不同选项的 label 和 aliases 不重复。',
            dedupeKey: `${field}:${normalizedText}`,
            context: { field, text, optionIndexes: [previousIndex, optionIndex] },
          })
        } else {
          optionTexts.set(normalizedText, optionIndex)
        }
      })
    })

    if (column.summary && column.summary.method === 'custom' && !column.summary.custom) {
      diagnostics.push({
        code: 'DG-SUMMARY-001',
        level: 'warning',
        message: `字段“${field}”使用 custom 合计方式，但没有提供 custom 计算函数。`,
        suggestion: '提供 summary.custom，或改用内置合计方式。',
        dedupeKey: field,
        context: { field },
      })
    }
  })

  fieldIndexes.forEach((indexes, field) => {
    if (indexes.length > 1) {
      diagnostics.push({
        code: 'DG-COLUMN-006',
        level: 'error',
        message: `存在重复列 field“${field}”，后续列可能覆盖前一列的状态。`,
        suggestion: '确保每个 DataGridColumn.field 唯一。',
        dedupeKey: field,
        context: { field, columnIndexes: indexes },
      })
    }
  })

  const columnMap = new Map(options.columns.map((column) => [String(column.field), column]))
  const columnMergeOwners = new Map<string, string[]>()
  options.columns.forEach((column) => {
    const field = String(column.field)
    const rowMergeFields =
      column.rowMerge && column.rowMerge !== true && column.rowMerge.by?.length
        ? column.rowMerge.by.map(String)
        : [field]
    const invalidRowMergeFields = column.rowMerge
      ? rowMergeFields.filter((item) => !columnMap.has(item))
      : []
    if (invalidRowMergeFields.length) {
      diagnostics.push({
        code: 'DG-MERGE-003',
        level: 'error',
        message: `字段“${field}”的 rowMerge.by 包含不存在的业务字段。`,
        suggestion: 'rowMerge.by 只能引用当前 DataGrid columns 中已声明的字段。',
        dedupeKey: field,
        context: { field, invalidFields: invalidRowMergeFields },
      })
    }
    if ((column.rowMerge || column.columnMerge) && column.editor) {
      diagnostics.push({
        code: 'DG-MERGE-002',
        level: 'warning',
        message: `字段“${field}”同时配置了单元格合并和编辑器，合并区域将保持只读。`,
        suggestion: '移除合并列的 editor，或将可编辑值放在不参与合并的列中。',
        dedupeKey: field,
        context: { field },
      })
    }

    const mergeFields = column.columnMerge?.fields.map(String) ?? []
    if (!mergeFields.length) {
      return
    }
    const invalidColumnMerge =
      mergeFields.length < 2 ||
      mergeFields[0] !== field ||
      new Set(mergeFields).size !== mergeFields.length ||
      mergeFields.some((item) => !columnMap.has(item))
    if (invalidColumnMerge) {
      diagnostics.push({
        code: 'DG-MERGE-004',
        level: 'error',
        message: `字段“${field}”的 columnMerge.fields 不是有效的连续业务字段列表。`,
        suggestion: '至少提供两个唯一字段，第一项使用当前字段，并确保所有字段都存在。',
        dedupeKey: field,
        context: { field, mergeFields },
      })
      return
    }
    mergeFields.forEach((item) => {
      const owners = columnMergeOwners.get(item) ?? []
      owners.push(field)
      columnMergeOwners.set(item, owners)
    })
    const participantColumns = mergeFields.map((item) => columnMap.get(item)!)
    const sourceIndexes = mergeFields.map((item) =>
      options.columns.findIndex((candidate) => String(candidate.field) === item),
    )
    const hasContinuousOrder = sourceIndexes.every(
      (sourceIndex, index) => index === 0 || sourceIndex === sourceIndexes[index - 1] + 1,
    )
    const hasSameFixed = participantColumns.every(
      (item) => item.fixed === participantColumns[0].fixed,
    )
    const hasMutableColumn = participantColumns.some(
      (item) => item.configurable !== false || item.hideable !== false,
    )
    if (!hasContinuousOrder || !hasSameFixed || hasMutableColumn) {
      diagnostics.push({
        code: 'DG-MERGE-005',
        level: 'warning',
        message: `字段“${field}”的列合并参与列可能因顺序、固定区域或用户列配置而失效。`,
        suggestion: '保持参与列连续且 fixed 相同，并将 configurable 和 hideable 都设置为 false。',
        dedupeKey: field,
        context: { field, mergeFields, hasContinuousOrder, hasSameFixed, hasMutableColumn },
      })
    }
  })

  columnMergeOwners.forEach((owners, field) => {
    const column = columnMap.get(field)
    if (owners.length > 1 || column?.rowMerge) {
      diagnostics.push({
        code: 'DG-MERGE-001',
        level: 'error',
        message: `字段“${field}”同时属于多个合并区域，渲染结果存在冲突。`,
        suggestion: '确保每个业务字段最多属于一个行合并或列合并区域。',
        dedupeKey: field,
        context: { field, columnMergeOwners: owners, hasRowMerge: Boolean(column?.rowMerge) },
      })
    }
  })

  options.slotNames
    .filter((slotName) => slotName.startsWith('cell-'))
    .forEach((slotName) => {
      const field = slotName.slice('cell-'.length)
      if (!fieldIndexes.has(field)) {
        diagnostics.push({
          code: 'DG-SLOT-001',
          level: 'warning',
          message: `插槽“${slotName}”无法匹配任何业务列，因此不会被渲染。`,
          suggestion: '检查插槽名称是否为 cell-加实际列 field。',
          dedupeKey: slotName,
          context: { slotName },
        })
      }
    })

  if (
    options.validation === false &&
    (options.hasRowRules || options.columns.some((column) => Boolean(column.rules?.length)))
  ) {
    diagnostics.push({
      code: 'DG-FEATURE-001',
      level: 'warning',
      message: '配置了字段或行校验规则，但 validation=false，所有业务校验都会被忽略。',
      suggestion: '移除 validation=false，或同时移除不需要执行的校验规则。',
    })
  }
  if (options.validation && (options.validation.concurrency ?? 1) < 1) {
    diagnostics.push({
      code: 'DG-FEATURE-002',
      level: 'warning',
      message: 'validation.concurrency 小于 1，实际执行时会被修正为 1。',
      suggestion: '将 concurrency 配置为大于或等于 1 的整数。',
    })
  }
  if (
    options.history &&
    options.history.limit !== undefined &&
    (!Number.isInteger(options.history.limit) || options.history.limit < 1)
  ) {
    diagnostics.push({
      code: 'DG-FEATURE-006',
      level: 'warning',
      message: 'history.limit 不是大于 0 的整数，历史记录容量可能不符合预期。',
      suggestion: '将 history.limit 配置为大于 0 的整数。',
    })
  }
  if (options.columnSetting) {
    if (!options.columnSetting.key.trim()) {
      diagnostics.push({
        code: 'DG-SETTING-001',
        level: 'error',
        message: 'columnSetting.key 为空，不同表格的用户列配置可能相互污染。',
        suggestion: '为每个业务表格提供非空且稳定的 columnSetting.key。',
      })
    }
    if (
      options.columnSetting.minVisibleCount !== undefined &&
      (!Number.isInteger(options.columnSetting.minVisibleCount) ||
        options.columnSetting.minVisibleCount < 1 ||
        options.columnSetting.minVisibleCount > options.columns.length)
    ) {
      diagnostics.push({
        code: 'DG-SETTING-002',
        level: 'warning',
        message: 'columnSetting.minVisibleCount 超出有效范围，实际值会被组件修正。',
        suggestion: `配置 1 到 ${Math.max(1, options.columns.length)} 之间的整数。`,
        context: {
          minVisibleCount: options.columnSetting.minVisibleCount,
          columnCount: options.columns.length,
        },
      })
    }
  }

  return diagnostics
}

/** 收集当前数据行和外部选择状态中的行标识诊断。 */
export function collectDataGridRowDiagnostics<Row extends DataGridRow>(
  options: DataGridRowDiagnosticOptions<Row>,
) {
  const diagnostics: DataGridDiagnosticInput[] = []

  if (options.requiresStableRowKey) {
    options.rowKeyIssues.forEach((issue) => {
      if (issue.type === 'duplicate') {
        diagnostics.push({
          code: 'DG-ROW-002',
          level: 'error',
          message: '数据中存在重复 rowKey，异常行已改用当前组件实例的私有身份。',
          suggestion: '确保每一行具有类型和值都唯一的业务 rowKey。',
          dedupeKey: `${typeof issue.value}:${String(issue.value)}`,
          context: { dataIndexes: issue.dataIndexes, value: issue.value },
        })
        return
      }
      const dataIndex = issue.dataIndexes[0]
      diagnostics.push({
        code: 'DG-ROW-001',
        level: 'error',
        message: `第 ${dataIndex + 1} 行无法解析有效 rowKey。`,
        suggestion: '确保 rowKey 返回非空字符串或有限数字。',
        dedupeKey: String(dataIndex),
        context: { dataIndex, value: issue.value, error: issue.message },
      })
    })
  }

  if (options.requiresStableRowKey && !options.hasExplicitRowKey) {
    diagnostics.push({
      code: 'DG-ROW-007',
      level: 'error',
      message: '启用了强依赖稳定行标识的功能，但未显式声明 rowKey。',
      suggestion: '显式配置 row-key="__dataGridRowKey"、稳定业务字段或解析函数。',
      dedupeKey: 'required',
    })
  }

  if (options.requiresStableRowKey && options.generatedRowKeyCount) {
    diagnostics.push({
      code: 'DG-ROW-004',
      level: 'error',
      message: `有 ${options.generatedRowKeyCount} 行正在使用当前组件实例的私有临时 rowKey。`,
      suggestion: '提供稳定业务 rowKey，避免跨页保留选择在数据替换后失效。',
      dedupeKey: String(options.generatedRowKeyCount),
      context: { generatedRowKeyCount: options.generatedRowKeyCount },
    })
  }

  const selectedKeyIndexes = new Map<string, number[]>()
  options.selectedRowKeys.forEach((rowKey, index) => {
    if (!isDataGridRowKey(rowKey)) {
      diagnostics.push({
        code: 'DG-ROW-005',
        level: 'warning',
        message: `selectedRowKeys 的第 ${index + 1} 项不是有效行标识。`,
        suggestion: 'selectedRowKeys 只能包含非空字符串或有限数字。',
        dedupeKey: String(index),
        context: { selectedKeyIndex: index },
      })
      return
    }
    const token = encodeDataGridRowKey(rowKey)
    const indexes = selectedKeyIndexes.get(token) || []
    indexes.push(index)
    selectedKeyIndexes.set(token, indexes)
  })
  selectedKeyIndexes.forEach((indexes, rowKey) => {
    if (indexes.length > 1) {
      diagnostics.push({
        code: 'DG-ROW-006',
        level: 'warning',
        message: 'selectedRowKeys 中存在重复项，组件同步时会自动去重。',
        suggestion: '外部选择状态只保留唯一 rowKey。',
        dedupeKey: rowKey,
        context: { selectedKeyIndexes: indexes },
      })
    }
  })

  return diagnostics
}
