/**
 * 设置功能 IPC 通信模块
 * 处理快捷键的读取和保存
 */

import { ipcMain, globalShortcut } from 'electron'
import { loadShortcuts, saveShortcuts } from '../../shared/store'
import { registerShortcuts } from '../../shortcuts'

export function setupSettingsIpc() {
  ipcMain.handle('get-shortcuts', () => loadShortcuts())

  ipcMain.handle('save-shortcuts', (_, shortcuts) => {
    saveShortcuts(shortcuts)
    registerShortcuts()
    return true
  })

  ipcMain.handle('check-shortcut', (_, accelerator) => {
    if (!accelerator) return { available: true }
    try {
      const registered = globalShortcut.isRegistered(accelerator)
      return { available: !registered }
    } catch {
      return { available: false, error: '无效的快捷键' }
    }
  })
}
