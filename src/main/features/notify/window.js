/**
 * 通知窗口模块
 * 全屏覆盖通知，用于定时任务提醒（如喝水、休息等）
 */

import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { appIcon, isMac } from '../../shared/constants'
import { getPreloadPath } from '../../shared/window-utils'

let notifyWindow = null

/**
 * 显示全屏通知窗口
 * 覆盖整个屏幕，用于定时任务的提醒
 * @param {string} message - 要显示的通知内容
 */
export function showNotifyWindow(message) {
  if (notifyWindow && !notifyWindow.isDestroyed()) {
    notifyWindow.close()
  }

  const { width, height } = screen.getPrimaryDisplay().size

  notifyWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    icon: appIcon,
    type: isMac ? 'panel' : undefined,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    fullscreen: isMac,
    fullscreenable: isMac,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  const encodedMsg = encodeURIComponent(message)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    notifyWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + `/notify/index.html?msg=${encodedMsg}`)
  } else {
    notifyWindow.loadFile(join(__dirname, '../renderer/notify/index.html'), {
      query: { msg: message }
    })
  }

  notifyWindow.on('closed', () => {
    notifyWindow = null
  })
}

/** 获取通知窗口实例 */
export function getNotifyWindow() {
  return notifyWindow
}
