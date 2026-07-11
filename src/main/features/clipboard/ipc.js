/**
 * 剪贴板功能 IPC 通信模块
 * 处理剪贴板历史的增删查改操作
 */

import { ipcMain, clipboard } from 'electron'
import { getClipboardHistory, setClipboardHistory, saveClipboard } from '../../shared/store'

/** 注册剪贴板相关 IPC 处理器 */
export function setupClipboardIpc() {
  // 获取剪贴板历史列表
  ipcMain.handle('get-clipboard-history', () => getClipboardHistory())

  // 清空所有历史记录
  ipcMain.handle('clear-clipboard-history', () => {
    setClipboardHistory([])
    saveClipboard()
    return true
  })

  // 删除指定索引的历史记录
  ipcMain.handle('delete-clipboard-item', (_, index) => {
    const history = getClipboardHistory()
    history.splice(index, 1)
    saveClipboard()
    return history
  })

  // 复制指定文本到剪贴板
  ipcMain.handle('copy-clipboard-item', (_, text) => {
    clipboard.writeText(text)
    return true
  })
}
