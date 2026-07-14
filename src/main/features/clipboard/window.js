/**
 * 剪贴板历史窗口模块
 * 提供剪贴板历史记录的查看和管理界面
 */

import { BrowserWindow } from 'electron'
import { appIcon, isMac } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'

let clipboardWindow = null

/** 打开剪贴板历史窗口（单例，置顶） */
export function openClipboardWindow() {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) {
    clipboardWindow.focus()
    return
  }

  clipboardWindow = new BrowserWindow({
    width: 500,
    height: 600,
    title: '剪贴板历史 - Desktop Cat',
    icon: appIcon,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(clipboardWindow, 'clipboard/index.html')

  clipboardWindow.on('closed', () => {
    clipboardWindow = null
  })
}

/** 获取剪贴板窗口实例 */
export function getClipboardWindow() {
  return clipboardWindow
}
