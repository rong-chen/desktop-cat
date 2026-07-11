/**
 * 猫咪拖拽 IPC 通信模块
 * 处理猫咪窗口的拖拽移动和鼠标穿透控制
 */

import { ipcMain, BrowserWindow, screen } from 'electron'
import { getCatWindow } from './window'
import { getChatWindow, hideChat, calcChatPosition, syncChatPosition } from '../chat/window'
import { openSettingsWindow } from '../settings/window'
import { openClipboardWindow } from '../clipboard/window'
import { openJsonViewerWindow } from '../json-viewer/window'
import { openTasksWindow } from '../tasks/window'
import { startScreenshot } from '../screenshot/capture'

// 拖拽状态（模块级别，供 chat/ipc 判断）
let isDragging = false

/** 获取拖拽状态 */
export function getIsDragging() {
  return isDragging
}

/** 注册猫咪相关 IPC 处理器 */
export function setupCatIpc() {
  // 设置窗口鼠标穿透（用于猫咪和聊天气泡的鼠标事件控制）
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  let dragStartMouse = null
  let dragStartWin = null
  let dragPollTimer = null

  // 开始拖拽：记录起始位置，启动 16ms 轮询跟踪鼠标
  ipcMain.on('drag-start', (_, { x, y }) => {
    const catWin = getCatWindow()
    isDragging = true
    const [wx, wy] = catWin.getPosition()
    dragStartMouse = { x, y }
    dragStartWin = { x: wx, y: wy }
    hideChat()

    if (dragPollTimer) clearInterval(dragPollTimer)
    dragPollTimer = setInterval(() => {
      if (!isDragging) return
      const cursor = screen.getCursorScreenPoint()
      const dx = cursor.x - dragStartMouse.x
      const dy = cursor.y - dragStartMouse.y
      catWin.setPosition(dragStartWin.x + dx, dragStartWin.y + dy)
    }, 16)
  })

  // 结束拖拽：停止轮询，更新聊天气泡位置并显示菜单
  ipcMain.on('drag-end', () => {
    isDragging = false
    if (dragPollTimer) {
      clearInterval(dragPollTimer)
      dragPollTimer = null
    }
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) {
      const pos = calcChatPosition()
      chatWin.setPosition(pos.x, pos.y)
      chatWin.webContents.send('chat-update', { placement: pos.placement, mode: 'menu' })
      chatWin.showInactive()
    }
  })

  // 增量移动窗口位置
  ipcMain.on('window-move', (_, { dx, dy }) => {
    const catWin = getCatWindow()
    const [x, y] = catWin.getPosition()
    catWin.setPosition(x + dx, y + dy)
    syncChatPosition()
  })

  // 获取主窗口位置和屏幕尺寸信息
  ipcMain.handle('get-window-info', () => {
    const catWin = getCatWindow()
    const [x, y] = catWin.getPosition()
    const [w, h] = catWin.getSize()
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { x, y, w, h, screenWidth: width, screenHeight: height }
  })

  // ---- 打开各功能窗口的 IPC ----
  // 提供 IPC 通道给渲染进程调用
  ipcMain.on('open-settings', () => openSettingsWindow())
  ipcMain.on('open-clipboard', () => openClipboardWindow())
  ipcMain.on('open-json-viewer', () => openJsonViewerWindow())
  ipcMain.on('open-tasks', () => openTasksWindow())
  ipcMain.on('start-screenshot', () => startScreenshot())
}
