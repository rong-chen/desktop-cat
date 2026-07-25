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
  setChatHideTimer,
  pauseChatHide,
  resumeChatHide
} from './ai-service'

/** 注册聊天相关 IPC 处理器 */
export function setupChatIpc() {
  let lastChatHeight = 0

  // 切换聊天气泡显示模式（menu: 显示菜单 / 其他: 延迟隐藏）
  ipcMain.on('set-chat-mode', (_, mode) => {
    const chatWin = getChatWindow()
    if (!chatWin || chatWin.isDestroyed()) return
    if (getIsDragging()) return

    if (mode === 'menu') {
      const menuTimer = getChatMenuTimer()
      if (menuTimer) {
        clearTimeout(menuTimer)
        setChatMenuTimer(null)
      }
      const pos = calcChatPosition()
      chatWin.setPosition(pos.x, pos.y)
      chatWin.webContents.send('chat-update', { placement: pos.placement })
      chatWin.showInactive()
    } else {
      // 鼠标离开猫咪，如果正在倒计时中则让倒计时自己处理
      if (getChatHideTimer()) return
      const oldTimer = getChatMenuTimer()
      if (oldTimer) clearTimeout(oldTimer)
      const timer = setTimeout(() => {
        const win = getChatWindow()
        if (!win || win.isDestroyed()) return
        win.hide()
      }, 500)
      setChatMenuTimer(timer)
    }
  })

  // 暂停聊天气泡隐藏倒计时
  ipcMain.on('pause-chat-hide', () => {
    pauseChatHide()
  })

  // 恢复聊天气泡隐藏倒计时
  ipcMain.on('resume-chat-hide', () => {
    resumeChatHide()
  })

  // 前端请求隐藏聊天窗口（无文字且鼠标移出）
  ipcMain.on('hide-chat-window', () => {
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) {
      chatWin.hide()
    }
  })

  // 前端通知气泡内容高度变化，动态调整窗口大小
  ipcMain.on('resize-chat-window', (_, contentHeight) => {
    const chatWin = getChatWindow()
    if (!chatWin || chatWin.isDestroyed()) return
    const padding = 8
    const newH = contentHeight + padding
    if (newH === lastChatHeight) return
    const oldH = lastChatHeight
    lastChatHeight = newH
    const [w] = chatWin.getSize()
    chatWin.setSize(w, newH)
    if (oldH > 0) {
      // 保持底部位置不变，向上扩展
      const [x, y] = chatWin.getPosition()
      const dy = oldH - newH
      if (dy !== 0) {
        chatWin.setPosition(x, y + dy)
      }
    } else {
      // 首次 resize，重新计算正确位置
      const pos = calcChatPosition()
      chatWin.setPosition(pos.x, pos.y)
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
