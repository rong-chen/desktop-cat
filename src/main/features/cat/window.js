/**
 * 猫咪主窗口模块
 * 透明无边框窗口，显示桌面猫咪精灵，置顶于屏幕右下角
 */

import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { appIcon, isMac } from '../../shared/constants'
import { getPreloadPath } from '../../shared/window-utils'

let mainWindow = null

/**
 * 创建主窗口 - 桌面猫咪
 * 透明无边框窗口，置顶显示在屏幕右下角
 * 默认忽略鼠标事件（穿透点击），通过 forward 参数允许 hover 检测
 */
export function createCatWindow() {
  const display = screen.getPrimaryDisplay()
  const { x: waX, y: waY, width, height } = display.workArea
  const { height: fullH } = display.size
  const winSize = 130
  const dockSize = fullH - height - waY // macOS Dock 栏高度
  const margin = 20

  mainWindow = new BrowserWindow({
    width: winSize,
    height: winSize,
    x: waX + width - winSize - margin - dockSize,
    y: waY + height - winSize - margin,
    icon: appIcon,
    type: isMac ? 'panel' : undefined,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/cat/index.html')
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/cat/index.html'))
  }

}


/** 获取猫咪主窗口实例 */
export function getCatWindow() {
  return mainWindow
}

