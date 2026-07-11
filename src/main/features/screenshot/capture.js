/**
 * 截图捕获逻辑模块
 * 使用 node-screenshots 库进行全屏截取
 */

import { screen, nativeImage } from 'electron'
import { getChatWindow } from '../chat/window'
import { getCatWindow } from '../cat/window'
import { createScreenshotWindow, getScreenshotWindow, setScreenshotImage } from './window'
import { getChatHideTimer, setChatHideTimer, getChatMenuTimer, setChatMenuTimer } from '../chat/ai-service'

/**
 * 开始截图流程
 * 1. 隐藏猫咪和聊天气泡（设为透明避免被截入）
 * 2. 使用 node-screenshots 库捕获全屏
 * 3. 将截图数据发送到截图窗口供用户选区裁剪
 */
export function startScreenshot() {
  const chatWin = getChatWindow()
  const catWin = getCatWindow()

  // 隐藏聊天气泡避免被截入
  if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(0)

  // 清除聊天相关定时器
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

  const display = screen.getPrimaryDisplay()
  const { width, height } = display.size
  const scaleFactor = display.scaleFactor

  // 使用原生截图库捕获屏幕
  const { Monitor } = require('node-screenshots')
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
  const imageDataUrl = screenshotImg.toDataURL()

  const screenshotData = { imageDataUrl, scaleFactor, width, height }

  let screenshotWin = getScreenshotWindow()
  if (!screenshotWin || screenshotWin.isDestroyed()) {
    createScreenshotWindow()
    screenshotWin = getScreenshotWindow()
    screenshotWin.webContents.on('did-finish-load', () => {
      screenshotWin.webContents.send('screenshot-data', screenshotData)
    })
  } else {
    screenshotWin.webContents.send('screenshot-data', screenshotData)
  }
}
