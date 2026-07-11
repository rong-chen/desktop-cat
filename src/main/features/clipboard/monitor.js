/**
 * 剪贴板轮询监听模块
 * 每 500ms 检查剪贴板内容变化，有新内容则存入历史
 */

import { clipboard } from 'electron'
import { getClipboardHistory, setClipboardHistory, saveClipboard } from '../../shared/store'

let clipboardTimer = null

/**
 * 启动剪贴板轮询监听
 * 最多保留 200 条历史记录
 */
export function startClipboardWatch() {
  let lastText = clipboard.readText()

  clipboardTimer = setInterval(() => {
    const text = clipboard.readText()
    if (text && text !== lastText) {
      lastText = text
      let history = getClipboardHistory()
      history.unshift({ text, time: Date.now() })
      if (history.length > 200) {
        history = history.slice(0, 200)
        setClipboardHistory(history)
      }
      saveClipboard()
    }
  }, 500)
}

/** 停止剪贴板轮询 */
export function stopClipboardWatch() {
  if (clipboardTimer) {
    clearInterval(clipboardTimer)
    clipboardTimer = null
  }
}

/** 获取剪贴板定时器（用于退出时清理） */
export function getClipboardTimer() {
  return clipboardTimer
}
