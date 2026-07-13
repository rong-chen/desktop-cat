/**
 * 截图捕获逻辑模块
 * 使用 node-screenshots 库进行全屏截取
 */

import { screen, nativeImage, dialog, shell, globalShortcut } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { getChatWindow } from '../chat/window'
import { getCatWindow } from '../cat/window'
import {
  createScreenshotWindow,
  getScreenshotWindow,
  setScreenshotImage
} from './window'
import {
  getChatHideTimer,
  setChatHideTimer,
  getChatMenuTimer,
  setChatMenuTimer
} from '../chat/ai-service'

async function requestScreenCapturePermission() {
  const { response } = await dialog.showMessageBox({
    type: 'warning',
    title: '需要屏幕录制权限',
    message: '截图功能需要「屏幕录制」权限，请在系统设置中授权后重试。',
    buttons: ['打开系统设置', '取消'],
    defaultId: 0
  })
  if (response === 0) {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  }
}

export function startScreenshot() {
  const chatWin = getChatWindow()
  const catWin = getCatWindow()

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

  // 先截图（此时 app 窗口还可见，不影响 macOS 窗口层级）
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scaleFactor = display.scaleFactor

  let capturedImage
  let Window
  try {
    const nodeScreenshots = require('node-screenshots')
    const Monitor = nodeScreenshots.Monitor
    Window = nodeScreenshots.Window
    const monitors = Monitor.all()
    const monitor = monitors[0]
    if (!monitor) return

    // 截图前隐藏自身窗口，避免截到自己
    if (catWin && !catWin.isDestroyed()) catWin.setOpacity(0)
    if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(0)

    capturedImage = monitor.captureImageSync()
  } catch {
    if (catWin && !catWin.isDestroyed()) catWin.setOpacity(1)
    if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(1)
    requestScreenCapturePermission()
    return
  }

  const pngBuffer = capturedImage.toPngSync()
  const screenshotImg = nativeImage.createFromBuffer(pngBuffer)
  setScreenshotImage(screenshotImg)

  const tmpFile = join(tmpdir(), `desktop-cat-screenshot-${Date.now()}.png`)
  writeFileSync(tmpFile, pngBuffer)

  const allWindows = Window.all()
  const windowRects = allWindows
    .filter((w) => w.width() > 0 && w.height() > 0)
    .map((w) => ({
      x: w.x(),
      y: w.y(),
      w: w.width(),
      h: w.height()
    }))

  const screenshotData = { imagePath: tmpFile, scaleFactor, width, height, windowRects }

  // 截图完成后再显示截图窗口
  let win = getScreenshotWindow()
  if (!win || win.isDestroyed()) {
    createScreenshotWindow()
    win = getScreenshotWindow()
  }
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(true, 'screen-saver')
    if (process.platform === 'win32') {
      win.show()
    } else {
      win.showInactive()
    }
    globalShortcut.register('Escape', () => {
      const w = getScreenshotWindow()
      if (w && !w.isDestroyed()) w.close()
    })

    if (win.webContents.isLoading()) {
      win.webContents.on('did-finish-load', () => {
        win.webContents.send('screenshot-data', screenshotData)
      })
    } else {
      win.webContents.send('screenshot-data', screenshotData)
    }
  }
}
