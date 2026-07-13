/**
 * 截图窗口模块
 * 全屏透明窗口，用于绘制截图选区和标注编辑
 */

import { BrowserWindow, screen, globalShortcut } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { getPreloadPath } from '../../shared/window-utils'
import { getChatWindow } from '../chat/window'
import { getCatWindow } from '../cat/window'

let screenshotWindow = null
let screenshotImage = null
let screenshotReady = false

/** 创建截图窗口 */
export function createScreenshotWindow() {
  if (screenshotWindow && !screenshotWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width, height } = display.bounds

  const isWin = process.platform === 'win32'

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
    resizable: isWin,
    skipTaskbar: true,
    fullscreenable: false,
    enableLargerThanScreen: isWin,
    movable: false,
    focusable: isWin,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  screenshotWindow.setIgnoreMouseEvents(false)

  if (isWin) {
    screenshotWindow.on('show', () => {
      screenshotWindow.setBounds(display.bounds)
      screenshotWindow.setAlwaysOnTop(true, 'screen-saver', 2147483647)
      screenshotWindow.setResizable(false)
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    screenshotWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/screenshot/index.html')
  } else {
    screenshotWindow.loadFile(join(__dirname, '../renderer/screenshot/index.html'))
  }

  screenshotWindow.webContents.on('did-finish-load', () => {
    screenshotReady = true
  })

  screenshotWindow.on('closed', () => {
    globalShortcut.unregister('Escape')
    globalShortcut.unregister('CommandOrControl+C')
    screenshotWindow = null
    screenshotImage = null
    screenshotReady = false
    const catWin = getCatWindow()
    if (catWin && !catWin.isDestroyed()) catWin.setOpacity(1)
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(1)
    setTimeout(() => createScreenshotWindow(), 300)
  })
}

/** 截图窗口是否已加载完成可用 */
export function isScreenshotReady() {
  return screenshotReady && screenshotWindow && !screenshotWindow.isDestroyed()
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
