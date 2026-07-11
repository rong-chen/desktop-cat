/**
 * 聊天功能 IPC 通信模块
 * 处理聊天模式切换、AI 对话和配置管理
 */

import { ipcMain } from 'electron'
import { loadAiConfig, saveAiConfig } from '../../shared/store'
import { getChatWindow, showChat, hideChat, calcChatPosition } from './window'
import { getIsDragging } from '../cat/ipc'
import {
  handleChatCompletion,
  startJokeIfDecompress,
  getChatMenuTimer,
  setChatMenuTimer,
  getChatHideTimer,
  setChatHideTimer
} from './ai-service'

/** 注册聊天相关 IPC 处理器 */
export function setupChatIpc() {
  // 切换聊天气泡显示模式（menu: 显示菜单 / 其他: 延迟隐藏）
  ipcMain.on('set-chat-mode', (_, mode) => {
    const chatWin = getChatWindow()
    if (!chatWin || chatWin.isDestroyed()) return
    if (getIsDragging()) return

    if (mode === 'menu') {
      // 清除隐藏定时器，显示菜单模式
      const menuTimer = getChatMenuTimer()
      if (menuTimer) {
        clearTimeout(menuTimer)
        setChatMenuTimer(null)
      }
      const hideTimer = getChatHideTimer()
      if (hideTimer) {
        clearTimeout(hideTimer)
        setChatHideTimer(null)
      }
      const pos = calcChatPosition()
      chatWin.setPosition(pos.x, pos.y)
      chatWin.webContents.send('chat-update', { placement: pos.placement, mode: 'menu' })
      chatWin.showInactive()
    } else {
      // 非菜单模式，延迟 500ms 后隐藏
      const oldTimer = getChatMenuTimer()
      if (oldTimer) clearTimeout(oldTimer)
      const timer = setTimeout(() => {
        const win = getChatWindow()
        if (!win || win.isDestroyed()) return
        win.hide()
        win.webContents.send('chat-update', { mode: 'menu' })
      }, 500)
      setChatMenuTimer(timer)
    }
  })

  // 获取 AI 配置
  ipcMain.handle('get-ai-config', () => loadAiConfig())

  // 保存 AI 配置并根据模式启停笑话定时器
  ipcMain.handle('save-ai-config', (_, config) => {
    saveAiConfig(config)
    startJokeIfDecompress()
    return true
  })

  // AI 对话补全接口
  ipcMain.handle('chat-completion', async (event, messages) => {
    return handleChatCompletion(event, messages)
  })
}
