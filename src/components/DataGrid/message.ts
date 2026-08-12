import { ElMessage } from 'element-plus'

/**
 * DataGrid 操作反馈的消息类型。
 *
 * - `info`：普通说明信息。
 * - `success`：操作成功反馈。
 * - `warning`：可继续操作但需要关注的反馈。
 * - `error`：操作失败或数据无效反馈。
 */
export type DataGridMessageType = 'info' | 'success' | 'warning' | 'error'

/** DataGrid 向宿主应用请求消息反馈的适配器。 */
export interface DataGridMessageAdapter {
  /** 展示普通说明信息。 */
  info(message: string): void

  /** 展示操作成功反馈。 */
  success(message: string): void

  /** 展示需要关注的警告反馈。 */
  warning(message: string): void

  /** 展示操作失败反馈。 */
  error(message: string): void
}

const elementPlusMessageAdapter: DataGridMessageAdapter = {
  info: (message) => ElMessage.info({ message, showClose: true }),
  success: (message) => ElMessage.success({ message, showClose: true }),
  warning: (message) => ElMessage.warning({ message, showClose: true, duration: 6000 }),
  error: (message) => ElMessage.error({ message, showClose: true, duration: 8000 }),
}

/** 默认使用 Element Plus 实现的 DataGrid 消息 API。 */
export const dataGridMessage = {
  show(type: DataGridMessageType, message: string) {
    elementPlusMessageAdapter[type](message)
  },
  info(message: string) {
    elementPlusMessageAdapter.info(message)
  },
  success(message: string) {
    elementPlusMessageAdapter.success(message)
  },
  warning(message: string) {
    elementPlusMessageAdapter.warning(message)
  },
  error(message: string) {
    elementPlusMessageAdapter.error(message)
  },
}
