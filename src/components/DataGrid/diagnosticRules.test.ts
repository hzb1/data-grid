import { describe, expect, it } from 'vitest'
import { collectDataGridRowDiagnostics } from './diagnosticRules'
import { createDataGridRowKeySnapshot } from './rowKey'

/** 创建测试所需的 DataGrid 行标识诊断。 */
function createRowDiagnostics(requiresStableRowKey: boolean, hasExplicitRowKey: boolean) {
  const rows = [{ id: 1 }, { id: 1 }, { id: null }]
  const snapshot = createDataGridRowKeySnapshot(rows, 'id')
  return collectDataGridRowDiagnostics({
    rows,
    selectedRowKeys: [],
    getRowKey: (_row, dataIndex) => snapshot.entries[dataIndex].rowKey,
    rowKeyIssues: snapshot.issues,
    generatedRowKeyCount: snapshot.entries.filter((entry) => entry.generated).length,
    hasExplicitRowKey,
    requiresStableRowKey,
  })
}

describe('DataGrid rowKey diagnostics', () => {
  it('普通表格允许使用私有临时 rowKey 且不要求显式配置', () => {
    const diagnostics = createRowDiagnostics(false, false)

    expect(diagnostics.filter((item) => item.code.startsWith('DG-ROW-'))).toEqual([])
  })

  it('强依赖表格将缺少显式配置和数据异常报告为 error', () => {
    const diagnostics = createRowDiagnostics(true, false)

    expect(diagnostics.find((item) => item.code === 'DG-ROW-007')?.level).toBe('error')
    expect(diagnostics.find((item) => item.code === 'DG-ROW-001')?.level).toBe('error')
    expect(diagnostics.find((item) => item.code === 'DG-ROW-002')?.level).toBe('error')
  })

  it('显式声明 rowKey 后不再输出缺少配置诊断', () => {
    const diagnostics = createRowDiagnostics(true, true)

    expect(diagnostics.some((item) => item.code === 'DG-ROW-007')).toBe(false)
  })
})
