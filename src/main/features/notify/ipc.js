/**
 * 通知窗口 IPC 通信模块
 */

import { ipcMain } from 'electron'
import { getNotifyWindow } from './window'

/** 注册通知相关 IPC 处理器 */
export function setupNotifyIpc() {
  // 关闭通知窗口
  ipcMain.on('close-notify', () => {
    const win = getNotifyWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })
}
