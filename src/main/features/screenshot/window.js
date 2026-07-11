/**
 * 截图窗口模块
 * 全屏透明窗口，用于绘制截图选区和标注编辑
 */

import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { getPreloadPath } from '../../shared/window-utils'
import { getChatWindow } from '../chat/window'

let screenshotWindow = null
let screenshotImage = null

/** 创建截图窗口（全屏透明） */
export function createScreenshotWindow() {
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size

  screenshotWindow = new BrowserWindow({
    width,
    height,
    x: display.bounds.x,
    y: display.bounds.y,
    show: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    fullscreenable: false,
    enableLargerThanScreen: false,
    movable: false,
    focusable: false,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  screenshotWindow.setIgnoreMouseEvents(false)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    screenshotWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/screenshot/index.html')
  } else {
    screenshotWindow.loadFile(join(__dirname, '../renderer/screenshot/index.html'))
  }

  // 窗口关闭时清理资源并恢复其他窗口透明度
  screenshotWindow.on('closed', () => {
    screenshotWindow = null
    screenshotImage = null
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(1)
  })
}

/** 获取截图窗口实例 */
export function getScreenshotWindow() {
  return screenshotWindow
}

/** 获取截图图像数据 */
export function getScreenshotImage() {
  return screenshotImage
}

/** 设置截图图像数据 */
export function setScreenshotImage(img) {
  screenshotImage = img
}
