/**
 * Desktop Cat - 桌面猫咪应用主进程入口
 * 一个基于 Electron 的桌面宠物应用，集成了剪贴板管理、定时任务、截图、AI 聊天等功能
 *
 * 本文件仅负责应用生命周期管理和各功能模块的初始化调度
 */

import { app, BrowserWindow, globalShortcut } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'

// 共享模块
import { loadData } from './shared/store'

// 功能模块
import { createCatWindow } from './features/cat'
import { setupCatIpc } from './features/cat'
import { createChatWindow } from './features/chat'
import { setupChatIpc, startJokeIfDecompress } from './features/chat'
import { setupClipboardIpc, startClipboardWatch, stopClipboardWatch } from './features/clipboard'
import { setupSettingsIpc } from './features/settings'
import { setupNotifyIpc } from './features/notify'
import { setupTasksIpc, scheduleAllTasks, stopAllTasks } from './features/tasks'
import { setupScreenshotIpc } from './features/screenshot'
import { createScreenshotWindow } from './features/screenshot/window'
import { createTray } from './features/tray'
import { registerShortcuts } from './shortcuts'

/**
 * 注册所有 IPC 处理器
 * 按功能模块分别注册，保持各模块的独立性
 */
function setupAllIpc() {
  setupCatIpc()
  setupChatIpc()
  setupClipboardIpc()
  setupSettingsIpc()
  setupNotifyIpc()
  setupTasksIpc()
  setupScreenshotIpc()
}

// ======================== 应用生命周期 ========================

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.yuanzhijia.miaozs')

  // macOS 下设置为 accessory 模式（不显示在 Dock）
  if (process.platform === 'darwin') {
    app.setActivationPolicy('accessory')
  }

  // 监听新窗口创建，自动注册开发快捷键
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 依次初始化各模块
  loadData()
  setupAllIpc()
  createCatWindow()
  createChatWindow()
  createScreenshotWindow()
  createTray()
  startClipboardWatch()
  registerShortcuts()
  scheduleAllTasks()
  startJokeIfDecompress()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createCatWindow()
  })
})

// 托盘模式下所有窗口关闭不退出应用
app.on('window-all-closed', () => {})

// 应用退出前清理资源
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopClipboardWatch()
  stopAllTasks()
})
