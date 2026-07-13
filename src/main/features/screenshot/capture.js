/**
 * 截图捕获逻辑模块
 * 使用 node-screenshots 库进行全屏截取
 */

import { screen, nativeImage, systemPreferences, dialog, shell } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { getChatWindow } from '../chat/window'
import { getCatWindow } from '../cat/window'
import {
  createScreenshotWindow,
  getScreenshotWindow,
  setScreenshotImage,
  isScreenshotReady
} from './window'
import {
  getChatHideTimer,
  setChatHideTimer,
  getChatMenuTimer,
  setChatMenuTimer
} from '../chat/ai-service'

function hasScreenCapturePermission() {
  if (process.platform !== 'darwin') return true
  return systemPreferences.getMediaAccessStatus('screen') === 'granted'
}

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
  if (!hasScreenCapturePermission()) {
    requestScreenCapturePermission()
    return
  }
  const chatWin = getChatWindow()
  const catWin = getCatWindow()

  if (catWin && !catWin.isDestroyed()) catWin.setOpacity(0)
  if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(0)

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

  // 窗口已预创建，立即显示给用户即时反馈
  if (isScreenshotReady()) {
    const screenshotWin = getScreenshotWindow()
    screenshotWin.setAlwaysOnTop(true, 'screen-saver')
    if (process.platform === 'win32') {
      screenshotWin.show()
    } else {
      screenshotWin.showInactive()
    }
  }

  setTimeout(() => {
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.size
    const scaleFactor = display.scaleFactor

    const { Monitor, Window } = require('node-screenshots')
    const monitors = Monitor.all()
    const monitor = monitors[0]
    if (!monitor) {
      if (catWin && !catWin.isDestroyed()) catWin.setOpacity(1)
      if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(1)
      return
    }

    const capturedImage = monitor.captureImageSync()
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

    let win = getScreenshotWindow()
    if (!win || win.isDestroyed()) {
      createScreenshotWindow()
      win = getScreenshotWindow()
    }
    if (win && !win.isDestroyed()) {
      if (win.webContents.isLoading()) {
        win.webContents.on('did-finish-load', () => {
          win.webContents.send('screenshot-data', screenshotData)
        })
      } else {
        win.webContents.send('screenshot-data', screenshotData)
      }
    }
  }, 16)
}
