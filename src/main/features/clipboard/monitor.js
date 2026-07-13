/**
 * 剪贴板轮询监听模块
 * 每 500ms 检查剪贴板内容变化，支持文本和图片
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
  let lastImageDataUrl = ''

  const img = clipboard.readImage()
  if (!img.isEmpty()) {
    lastImageDataUrl = img.toDataURL()
  }

  clipboardTimer = setInterval(() => {
    const text = clipboard.readText()
    const image = clipboard.readImage()

    if (!image.isEmpty()) {
      const dataUrl = image.toDataURL()
      if (dataUrl !== lastImageDataUrl) {
        lastImageDataUrl = dataUrl
        lastText = text
        let history = getClipboardHistory()
        history.unshift({ type: 'image', dataUrl, time: Date.now() })
        if (history.length > 200) history = history.slice(0, 200)
        setClipboardHistory(history)
        saveClipboard()
        return
      }
    }

    if (text && text !== lastText) {
      lastText = text
      let history = getClipboardHistory()
      history.unshift({ type: 'text', text, time: Date.now() })
      if (history.length > 200) history = history.slice(0, 200)
      setClipboardHistory(history)
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
