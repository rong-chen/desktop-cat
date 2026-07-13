/**
 * 剪贴板轮询监听模块
 * 每 500ms 检查剪贴板内容变化，支持文本和图片
 */

import { clipboard } from 'electron'
import {
  getClipboardHistory,
  setClipboardHistory,
  saveClipboard,
  isClipboardLoaded
} from '../../shared/store'

// 图片 dataUrl 最大存储大小（512KB），超过则存缩略图
const MAX_IMAGE_SIZE = 512 * 1024

let clipboardTimer = null

/**
 * 启动剪贴板轮询监听
 * 最多保留 200 条历史记录
 */
export function startClipboardWatch() {
  let lastText = clipboard.readText()
  let lastImageHash = ''

  const img = clipboard.readImage()
  if (!img.isEmpty()) {
    lastImageHash = getImageHash(img)
  }

  clipboardTimer = setInterval(() => {
    if (!isClipboardLoaded()) return

    const text = clipboard.readText()
    const image = clipboard.readImage()

    if (!image.isEmpty()) {
      const hash = getImageHash(image)
      if (hash !== lastImageHash) {
        lastImageHash = hash
        lastText = text
        const dataUrl = getStorableDataUrl(image)
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

function getImageHash(img) {
  const size = img.getSize()
  return `${size.width}x${size.height}`
}

function getStorableDataUrl(img) {
  const dataUrl = img.toDataURL()
  if (dataUrl.length <= MAX_IMAGE_SIZE) return dataUrl
  // 缩放到合理尺寸再存储
  const size = img.getSize()
  const scale = Math.sqrt(MAX_IMAGE_SIZE / dataUrl.length)
  const w = Math.round(size.width * scale)
  const h = Math.round(size.height * scale)
  const resized = img.resize({ width: w, height: h })
  return resized.toDataURL()
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
