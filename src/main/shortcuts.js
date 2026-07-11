/**
 * 全局快捷键注册模块
 * 管理应用级别的键盘快捷键绑定
 */

import { globalShortcut } from 'electron'
import { loadShortcuts } from './shared/store'
import { getCatWindow } from './features/cat/window'
import { openSettingsWindow } from './features/settings/window'
import { openClipboardWindow } from './features/clipboard/window'
import { startScreenshot } from './features/screenshot/capture'

/**
 * 注册全局快捷键
 * 包括：显示/隐藏猫咪、打开设置、打开剪贴板、截图
 */
export function registerShortcuts() {
  globalShortcut.unregisterAll()
  const shortcuts = loadShortcuts()

  if (shortcuts.toggleCat) {
    globalShortcut.register(shortcuts.toggleCat, () => {
      const catWin = getCatWindow()
      if (catWin.isVisible()) catWin.hide()
      else catWin.show()
    })
  }

  if (shortcuts.openSettings) {
    globalShortcut.register(shortcuts.openSettings, () => {
      openSettingsWindow()
    })
  }

  if (shortcuts.openClipboard) {
    globalShortcut.register(shortcuts.openClipboard, () => {
      openClipboardWindow()
    })
  }

  if (shortcuts.screenshot) {
    globalShortcut.register(shortcuts.screenshot, () => {
      startScreenshot()
    })
  }
}
