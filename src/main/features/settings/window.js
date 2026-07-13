/**
 * 设置窗口模块
 * 提供 AI 模型配置和全局快捷键自定义界面
 */

import { BrowserWindow, globalShortcut } from 'electron'
import { appIcon } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'
import { registerShortcuts } from '../../shortcuts'

let settingsWindow = null

/** 打开设置窗口（单例） */
export function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 640,
    title: '设置 - Desktop Cat',
    icon: appIcon,
    resizable: false,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(settingsWindow, 'settings/index.html')

  globalShortcut.unregisterAll()

  settingsWindow.on('closed', () => {
    settingsWindow = null
    registerShortcuts()
  })
}

/** 获取设置窗口实例 */
export function getSettingsWindow() {
  return settingsWindow
}
