/**
 * 系统托盘模块
 * 提供右键菜单快捷入口：显示/隐藏猫咪、各功能窗口、退出
 */

import { app, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { isMac } from '../../shared/constants'
import { getCatWindow } from '../cat/window'
import { openSettingsWindow } from '../settings/window'
import { openClipboardWindow } from '../clipboard/window'
import { openJsonViewerWindow } from '../json-viewer/window'
import { openTasksWindow } from '../tasks/window'
import { startScreenshot } from '../screenshot/capture'

let tray = null

/** 创建系统托盘图标和菜单 */
export function createTray() {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const iconSize = isMac ? 18 : 16
  const icon = nativeImage.createFromPath(iconPath).resize({ width: iconSize, height: iconSize })
  tray = new Tray(icon)
  tray.setToolTip('Desktop Cat')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏猫咪',
      click: () => {
        const catWin = getCatWindow()
        if (catWin.isVisible()) catWin.hide()
        else catWin.show()
      }
    },
    { type: 'separator' },
    { label: '设置', click: () => openSettingsWindow() },
    { label: '截图', click: () => startScreenshot() },
    { label: '剪贴板历史', click: () => openClipboardWindow() },
    { label: 'JSON 查看器', click: () => openJsonViewerWindow() },
    { label: '定时任务', click: () => openTasksWindow() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Windows 下左键点击也弹出菜单
  if (!isMac) {
    tray.on('click', () => {
      tray.popUpContextMenu(contextMenu)
    })
  }
}
