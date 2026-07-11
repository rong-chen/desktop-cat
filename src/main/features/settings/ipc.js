/**
 * 设置功能 IPC 通信模块
 * 处理快捷键的读取和保存
 */

import { ipcMain } from 'electron'
import { loadShortcuts, saveShortcuts } from '../../shared/store'
import { registerShortcuts } from '../../shortcuts'

/** 注册设置相关 IPC 处理器 */
export function setupSettingsIpc() {
  // 获取当前快捷键配置
  ipcMain.handle('get-shortcuts', () => loadShortcuts())

  // 保存快捷键配置并重新注册
  ipcMain.handle('save-shortcuts', (_, shortcuts) => {
    saveShortcuts(shortcuts)
    registerShortcuts()
    return true
  })
}
