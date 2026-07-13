/**
 * 聊天气泡窗口模块
 * 透明无边框气泡窗口，跟随猫咪位置显示
 */

import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { appIcon, isMac, CHAT_W, CHAT_H, CHAT_OFFSET } from '../../shared/constants'
import { getPreloadPath } from '../../shared/window-utils'
import { getCatWindow } from '../cat/window'
import { sendChatGreeting } from './ai-service'

let chatWindow = null

/**
 * 计算聊天气泡的显示位置
 * 默认显示在猫咪上方，空间不够时显示在下方
 * 水平方向居中对齐猫咪，并确保不超出屏幕边界
 */
export function calcChatPosition() {
  const catWin = getCatWindow()
  if (!catWin || catWin.isDestroyed()) return { x: 0, y: 0, placement: 'top' }

  const [mx, my] = catWin.getPosition()
  const [mw, mh] = catWin.getSize()
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
  const padding = 4

  // 用实际窗口高度（如果窗口已创建）
  const chatH = (chatWindow && !chatWindow.isDestroyed()) ? chatWindow.getSize()[1] : CHAT_H

  const centerX = mx + Math.round(mw / 2) - Math.round(CHAT_W / 2)
  let x = Math.max(padding, Math.min(centerX, sw - CHAT_W - padding))

  let y = my - chatH - CHAT_OFFSET
  let placement = 'top'
  if (y < padding) {
    y = my + mh + CHAT_OFFSET
    placement = 'bottom'
  }
  if (y + chatH > sh - padding) {
    y = sh - chatH - padding
  }

  return { x, y, placement }
}

/** 显示聊天气泡（不获取焦点） */
export function showChat() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  const pos = calcChatPosition()
  chatWindow.setPosition(pos.x, pos.y)
  chatWindow.webContents.send('chat-update', { placement: pos.placement })
  chatWindow.showInactive()
}

/** 隐藏聊天气泡 */
export function hideChat() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  chatWindow.hide()
}

/** 同步聊天气泡位置（猫咪被拖动时调用） */
export function syncChatPosition() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  if (!chatWindow.isVisible()) return
  const pos = calcChatPosition()
  chatWindow.setPosition(pos.x, pos.y)
  chatWindow.webContents.send('chat-update', { placement: pos.placement })
}

/** 创建聊天气泡窗口 */
export function createChatWindow() {
  const pos = calcChatPosition()

  chatWindow = new BrowserWindow({
    width: CHAT_W,
    height: CHAT_H,
    x: pos.x,
    y: pos.y,
    icon: appIcon,
    type: isMac ? 'panel' : undefined,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  chatWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    chatWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/chat/index.html')
  } else {
    chatWindow.loadFile(join(__dirname, '../renderer/chat/index.html'))
  }

  // 加载完成后发送问候语
  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow.webContents.send('chat-update', { placement: pos.placement })
    sendChatGreeting()
  })

  chatWindow.on('closed', () => {
    chatWindow = null
  })
}

/** 获取聊天窗口实例 */
export function getChatWindow() {
  return chatWindow
}
