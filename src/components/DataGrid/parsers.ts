import Big from 'big.js'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import type {
  DataGridClipboardParser,
  DataGridDateParserConfig,
  DataGridNumberParserConfig,
  DataGridPercentageParserConfig,
} from './types'

const DATE_PATTERN = /^(\d{4})(?:-|\/|年)(\d{1,2})(?:-|\/|月)(\d{1,2})日?$/
const DATE_TIME_PATTERN =
  /^(\d{4})(?:-|\/|年)(\d{1,2})(?:-|\/|月)(\d{1,2})日?[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

dayjs.extend(customParseFormat)

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function assertDateParts(year: number, month: number, day: number) {
  const normalized = `${year}-${pad(month)}-${pad(day)}`
  if (!dayjs(normalized, 'YYYY-MM-DD', true).isValid()) {
    throw new Error('日期不存在')
  }
  return normalized
}

function parseExcelSerial(text: string) {
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    return
  }
  const serial = Number(text)
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) {
    return
  }
  const date = new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * 86400000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function parseDateText(text: string, config: DataGridDateParserConfig) {
  const value = text.trim()
  if (!value) {
    return config.emptyValue ?? null
  }
  const matched = value.match(DATE_PATTERN)
  if (matched) {
    return assertDateParts(Number(matched[1]), Number(matched[2]), Number(matched[3]))
  }
  if (config.allowExcelSerial !== false) {
    const excelDate = parseExcelSerial(value)
    if (excelDate) {
      return excelDate
    }
  }
  throw new Error(`无法识别日期：${text}`)
}

function normalizeNumericText(text: string, config: DataGridNumberParserConfig) {
  let value = text.trim()
  let negative = false
  if (config.allowAccountingNegative && /^\(.+\)$/.test(value)) {
    negative = true
    value = value.slice(1, -1).trim()
  }
  if (config.allowCurrencySymbol) {
    value = value.replace(/^[¥￥]\s*/, '')
  }
  const scientificPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)[eE][+-]?\d+$/
  const regularPattern = /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/
  if (!(regularPattern.test(value) || (config.allowScientific && scientificPattern.test(value)))) {
    throw new Error(`无法转换为数字：${text}`)
  }
  return `${negative ? '-' : ''}${value.replaceAll(',', '')}`
}

function createNumberParser(config: DataGridNumberParserConfig = {}): DataGridClipboardParser {
  return (text) => {
    if (!text.trim()) {
      return null
    }
    const value = new Big(normalizeNumericText(text, config))
    return typeof config.precision === 'number'
      ? Number(value.toFixed(config.precision))
      : Number(value.toString())
  }
}

export const dataGridClipboardParsers = {
  date(config: DataGridDateParserConfig = {}): DataGridClipboardParser {
    return (text) => parseDateText(text, config)
  },
  dateTime(config: DataGridDateParserConfig = {}): DataGridClipboardParser {
    return (text) => {
      const value = text.trim()
      if (!value) {
        return config.emptyValue ?? null
      }
      const matched = value.match(DATE_TIME_PATTERN)
      if (!matched) {
        throw new Error(`无法识别日期时间：${text}`)
      }
      const date = assertDateParts(Number(matched[1]), Number(matched[2]), Number(matched[3]))
      const hour = Number(matched[4])
      const minute = Number(matched[5])
      const second = Number(matched[6] || 0)
      if (hour > 23 || minute > 59 || second > 59) {
        throw new Error(`时间不存在：${text}`)
      }
      return `${date} ${pad(hour)}:${pad(minute)}:${pad(second)}`
    }
  },
  number(config: DataGridNumberParserConfig = {}) {
    return createNumberParser(config)
  },
  money(config: DataGridNumberParserConfig = {}) {
    return createNumberParser({
      allowCurrencySymbol: true,
      allowAccountingNegative: true,
      ...config,
    })
  },
  percentage(config: DataGridPercentageParserConfig): DataGridClipboardParser {
    return (text) => {
      const value = text.trim()
      if (!value) {
        return null
      }
      const hasPercentSign = value.endsWith('%')
      const numberValue = new Big(
        normalizeNumericText(hasPercentSign ? value.slice(0, -1) : value, {}),
      )
      const normalized =
        config.storage === 'decimal' && hasPercentSign ? numberValue.div(100) : numberValue
      return typeof config.precision === 'number'
        ? Number(normalized.toFixed(config.precision))
        : Number(normalized.toString())
    }
  },
}
