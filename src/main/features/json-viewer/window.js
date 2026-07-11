/**
 * JSON 查看器窗口模块
 * 基于 CodeMirror 的 JSON 数据查看器
 */

import { BrowserWindow } from 'electron'
import { appIcon, isMac } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'

let jsonViewerWindow = null

/** 打开 JSON 查看器窗口（单例） */
export function openJsonViewerWindow() {
  if (jsonViewerWindow && !jsonViewerWindow.isDestroyed()) {
    jsonViewerWindow.focus()
    return
  }

  jsonViewerWindow = new BrowserWindow({
    width: 1350,
    height: 1050,
    title: 'JSON 查看器 - Desktop Cat',
    icon: appIcon,
    type: isMac ? 'panel' : undefined,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(jsonViewerWindow, 'json-viewer/index.html')

  jsonViewerWindow.on('closed', () => {
    jsonViewerWindow = null
  })
}

/** 获取 JSON 查看器窗口实例 */
export function getJsonViewerWindow() {
  return jsonViewerWindow
}
