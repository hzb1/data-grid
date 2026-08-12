/** 当前最近一次激活单元格选区的 DataGrid 实例标识。 */
let activeDataGridClipboardOwner: symbol | undefined

/** 将当前 DataGrid 实例标记为文档级快捷键复制的目标。 */
export function claimDataGridClipboardOwner(owner: symbol) {
  activeDataGridClipboardOwner = owner
}

/** 当前 DataGrid 实例释放选区或卸载时，解除其快捷键复制目标身份。 */
export function releaseDataGridClipboardOwner(owner: symbol) {
  if (activeDataGridClipboardOwner === owner) {
    activeDataGridClipboardOwner = undefined
  }
}

/** 判断当前 DataGrid 实例是否为最近激活的快捷键复制目标。 */
export function isActiveDataGridClipboardOwner(owner: symbol) {
  return activeDataGridClipboardOwner === owner
}

/** DataGrid 单次粘贴事务的版本和取消控制器。 */
export interface DataGridPasteTransaction {
  /** 当前事务在所属 DataGrid 实例中的递增版本。 */
  version: number

  /** 取消当前事务异步校验和后续提交的控制器。 */
  controller: AbortController
}

/** 创建 DataGrid 实例级粘贴事务管理器，确保只有最后一次粘贴可以提交。 */
export function createDataGridPasteTransactionManager() {
  let version = 0
  let activeTransaction: DataGridPasteTransaction | undefined

  function cancel() {
    version += 1
    activeTransaction?.controller.abort()
    activeTransaction = undefined
  }

  function begin(): DataGridPasteTransaction {
    cancel()
    const transaction = {
      version,
      controller: new AbortController(),
    }
    activeTransaction = transaction
    return transaction
  }

  function isCurrent(transaction: DataGridPasteTransaction) {
    return activeTransaction === transaction && transaction.version === version
  }

  function finish(transaction: DataGridPasteTransaction) {
    if (activeTransaction === transaction) {
      activeTransaction = undefined
    }
  }

  return {
    begin,
    cancel,
    finish,
    isCurrent,
  }
}

function finishClipboardRow(rows: string[][], row: string[], preserveEmpty: boolean) {
  if (preserveEmpty || row.length > 1 || row[0] !== '') {
    rows.push(row)
  }
}

export function parseClipboardText(text: string): string[][] {
  if (!text) {
    return []
  }
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let afterQuote = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
        afterQuote = true
      } else {
        cell += character
      }
      continue
    }
    if (afterQuote && character !== '\t' && character !== '\n' && character !== '\r') {
      throw new Error(`引用单元格结束引号后存在非法字符：${character}`)
    }
    if (!afterQuote && character === '"' && cell === '') {
      quoted = true
      continue
    }
    if (character === '\t') {
      row.push(cell)
      cell = ''
      afterQuote = false
      continue
    }
    if (character === '\n' || character === '\r') {
      row.push(cell)
      finishClipboardRow(rows, row, true)
      row = []
      cell = ''
      afterQuote = false
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1
      }
      continue
    }
    cell += character
  }

  if (quoted) {
    throw new Error('引用单元格缺少结束引号')
  }
  row.push(cell)
  finishClipboardRow(rows, row, false)
  return rows
}

function serializeClipboardCell(value: unknown) {
  const text = String(value ?? '')
  if (!/[\t\r\n"]/.test(text)) {
    return text
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function serializeClipboardMatrix(matrix: unknown[][]) {
  return matrix.map((row) => row.map(serializeClipboardCell).join('\t')).join('\n')
}
