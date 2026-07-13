/**
 * 窗口公共工具函数
 * 提供子窗口配置和 URL 加载的统一封装
 */

import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { isMac } from './constants'

/**
 * 子窗口公共配置 - 处理 macOS 和 Windows 的标题栏差异
 * macOS 使用隐藏式标题栏 + 红绿灯按钮
 * Windows 使用隐藏标题栏 + 自定义叠加层
 */
export function subWindowOptions() {
  if (isMac) {
    return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } }
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fffaf3',
      symbolColor: '#5a4a3a',
      height: 44
    },
    autoHideMenuBar: true
  }
}

/**
 * 加载窗口对应的 HTML 页面
 * 开发模式使用 dev server URL，生产模式加载本地文件
 * @param {BrowserWindow} win - 目标窗口
 * @param {string} htmlPath - HTML 文件相对路径（如 'settings/index.html'）
 */
export function loadWindowUrl(win, htmlPath) {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/' + htmlPath)
  } else {
    win.loadFile(join(__dirname, '../renderer/' + htmlPath))
  }
}

/** 获取 preload 脚本路径 */
export function getPreloadPath() {
  return join(__dirname, '../preload/index.js')
}
