/**
 * 截图捕获逻辑模块
 * 使用 node-screenshots 库进行全屏截取
 */

import { screen, nativeImage } from 'electron'
import { getChatWindow } from '../chat/window'
import { getCatWindow } from '../cat/window'
import { createScreenshotWindow, getScreenshotWindow, setScreenshotImage } from './window'
import {
  getChatHideTimer,
  setChatHideTimer,
  getChatMenuTimer,
  setChatMenuTimer
} from '../chat/ai-service'

/**
 * 开始截图流程
 * 1. 隐藏猫咪和聊天气泡（设为透明避免被截入）
 * 2. 使用 node-screenshots 库捕获全屏
 * 3. 将截图数据发送到截图窗口供用户选区裁剪
 */
export function startScreenshot() {
  const chatWin = getChatWindow() // 获取聊天气泡窗口实例
  const catWin = getCatWindow() // 获取桌面猫咪窗口实例

  if (catWin && !catWin.isDestroyed()) catWin.setOpacity(0) // 猫咪窗口设为透明
  if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(0) // 聊天气泡设为透明

  const menuTimer = getChatMenuTimer() // 获取聊天菜单定时器
  if (menuTimer) {
    clearTimeout(menuTimer) // 清除菜单定时器，避免截图期间弹出菜单
    setChatMenuTimer(null) // 重置菜单定时器引用为空
  }
  const hideTimer = getChatHideTimer() // 获取聊天隐藏定时器
  if (hideTimer) {
    clearTimeout(hideTimer) // 清除隐藏定时器，避免截图期间触发隐藏逻辑
    setChatHideTimer(null) // 重置隐藏定时器引用为空
  }

  // 延迟 200ms 等待系统合成器刷新帧，确保窗口从屏幕画面中消失
  setTimeout(() => {
    const display = screen.getPrimaryDisplay() // 获取主显示器信息
    const { width, height } = display.size // 解构屏幕逻辑分辨率
    const scaleFactor = display.scaleFactor // 获取屏幕缩放因子（Retina 屏为 2）

    const { Monitor } = require('node-screenshots') // 动态加载原生截图库
    const monitors = Monitor.all() // 获取所有显示器列表
    const monitor = monitors[0] // 取主显示器
    if (!monitor) {
      // 没有可用显示器时恢复窗口并退出
      if (catWin && !catWin.isDestroyed()) catWin.setOpacity(1) // 恢复猫咪窗口
      if (chatWin && !chatWin.isDestroyed()) chatWin.setOpacity(1) // 恢复聊天气泡
      return
    }

    const capturedImage = monitor.captureImageSync() // 同步捕获屏幕图像
    const pngBuffer = capturedImage.toPngSync() // 将图像转为 PNG Buffer
    const screenshotImg = nativeImage.createFromBuffer(pngBuffer) // 创建 Electron nativeImage 对象
    setScreenshotImage(screenshotImg) // 缓存截图供后续裁剪使用
    const imageDataUrl = screenshotImg.toDataURL() // 转为 Data URL 便于传给渲染进程

    const screenshotData = { imageDataUrl, scaleFactor, width, height } // 组装截图数据

    let screenshotWin = getScreenshotWindow() // 获取已有的截图窗口
    if (!screenshotWin || screenshotWin.isDestroyed()) {
      // 窗口不存在或已销毁
      createScreenshotWindow() // 创建新的截图窗口
      screenshotWin = getScreenshotWindow() // 获取新创建的窗口实例
      screenshotWin.webContents.on('did-finish-load', () => {
        // 等待窗口加载完成
        screenshotWin.webContents.send('screenshot-data', screenshotData) // 发送截图数据到渲染进程
      })
    } else {
      screenshotWin.webContents.send('screenshot-data', screenshotData) // 窗口已存在，直接发送数据
    }
  }, 200)
}
