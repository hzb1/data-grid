import { describe, expect, it } from 'vitest'
import {
  createDataGridPasteTransactionManager,
  parseClipboardText,
  serializeClipboardMatrix,
} from './clipboard'
import { dataGridClipboardParsers } from './parsers'

describe('DataGrid clipboard text', () => {
  it('parses regular TSV and ignores the final row terminator', () => {
    expect(parseClipboardText('物料\t数量\r\nA001\t10\r\n')).toEqual([
      ['物料', '数量'],
      ['A001', '10'],
    ])
  })

  it('parses quoted tabs, line breaks and escaped quotes', () => {
    expect(parseClipboardText('"第一行\n第二行"\t"12""管"')).toEqual([['第一行\n第二行', '12"管']])
  })

  it('preserves quotes inside unquoted cells', () => {
    expect(parseClipboardText('规格为12"管\t正常')).toEqual([['规格为12"管', '正常']])
  })

  it('rejects malformed quoted cells instead of silently merging data', () => {
    expect(() => parseClipboardText('"未闭合\t下一列')).toThrow('引用单元格缺少结束引号')
    expect(() => parseClipboardText('"已闭合"非法字符\t下一列')).toThrow(
      '引用单元格结束引号后存在非法字符',
    )
  })

  it('preserves explicitly copied empty matrix cells', () => {
    expect(parseClipboardText('\t\r\n')).toEqual([['', '']])
    expect(parseClipboardText('\r\n')).toEqual([['']])
    expect(parseClipboardText('A\t\tC')).toEqual([['A', '', 'C']])
    expect(parseClipboardText('')).toEqual([])
  })

  it('round-trips cells containing tabs, line breaks and quotes', () => {
    const matrix = [
      ['普通文本', '第一行\n第二行', '规格为12"管'],
      ['', '尾列', ''],
    ]
    expect(parseClipboardText(serializeClipboardMatrix(matrix))).toEqual(matrix)
  })
})

describe('DataGrid clipboard date parser', () => {
  it('normalizes slash-separated date text copied from Excel or WPS', () => {
    const parseDate = dataGridClipboardParsers.date()

    expect(parseDate('2026/4/24', {})).toBe('2026-04-24')
  })

  it('rejects an invalid calendar date instead of preserving unusable text', () => {
    const parseDate = dataGridClipboardParsers.date()

    expect(() => parseDate('2026/2/30', {})).toThrow('日期不存在')
  })
})

describe('DataGrid paste transaction manager', () => {
  it('cancels the previous transaction when a new paste begins', () => {
    const manager = createDataGridPasteTransactionManager()
    const first = manager.begin()
    const second = manager.begin()

    expect(first.controller.signal.aborted).toBe(true)
    expect(manager.isCurrent(first)).toBe(false)
    expect(manager.isCurrent(second)).toBe(true)
  })

  it('invalidates the active transaction when external state changes', () => {
    const manager = createDataGridPasteTransactionManager()
    const transaction = manager.begin()

    manager.cancel()

    expect(transaction.controller.signal.aborted).toBe(true)
    expect(manager.isCurrent(transaction)).toBe(false)
  })

  it('does not let an old transaction finish a newer transaction', () => {
    const manager = createDataGridPasteTransactionManager()
    const first = manager.begin()
    const second = manager.begin()

    manager.finish(first)

    expect(manager.isCurrent(second)).toBe(true)
  })
})
