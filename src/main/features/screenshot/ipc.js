/**
 * 截图功能 IPC 通信模块
 * 处理截图的显示、取消、保存、复制和贴图操作
 */

import { ipcMain, clipboard, nativeImage, dialog, screen, BrowserWindow, app, globalShortcut } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { getScreenshotWindow } from './window'
import { recognizeText } from './ocr'
import { translateText } from './translate'

/** 注册截图相关 IPC 处理器 */
export function setupScreenshotIpc() {
  // 显示截图窗口
  ipcMain.on('screenshot-show', () => {
    const win = getScreenshotWindow()
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver')
      win.showInactive()
      globalShortcut.register('Escape', () => {
        const w = getScreenshotWindow()
        if (w && !w.isDestroyed()) w.close()
      })
      globalShortcut.register('CommandOrControl+C', () => {
        const w = getScreenshotWindow()
        if (w && !w.isDestroyed()) w.webContents.send('screenshot-copy')
      })
    }
  })

  // 取消截图
  ipcMain.on('screenshot-cancel', () => {
    const win = getScreenshotWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  // 截图完成 - 复制到剪贴板
  ipcMain.handle('screenshot-capture', (_, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    clipboard.writeImage(img)
    const win = getScreenshotWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
    return true
  })

  // 截图完成 - 保存到文件
  ipcMain.handle('screenshot-save', async (_, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl)
    const now = new Date()
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    const win = getScreenshotWindow()
    const result = await dialog.showSaveDialog(win, {
      defaultPath: join(app.getPath('pictures'), `screenshot-${ts}.png`),
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, img.toPNG())
    }
    if (win && !win.isDestroyed()) {
      win.close()
    }
    return !result.canceled
  })

  // 截图完成 - 钉在屏幕上（创建独立的置顶小窗口显示截图）
  ipcMain.handle('screenshot-pin', (_, dataUrl, rect) => {
    const win = getScreenshotWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }

    // 创建贴图窗口，大小和位置与选区一致
    const pinWin = new BrowserWindow({
      width: rect.w,
      height: rect.h,
      x: rect.x,
      y: rect.y,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
      transparent: true,
      hasShadow: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })

    pinWin.loadURL(
      `data:text/html,<!DOCTYPE html><html><head><style>*{margin:0;padding:0}body{overflow:hidden}img{width:100%;height:100%;object-fit:contain;display:block;-webkit-user-drag:none;user-select:none}</style></head><body><img src="${encodeURI(dataUrl)}"/></body></html>`
    )

    // Esc 关闭贴图窗口
    pinWin.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape') {
        event.preventDefault()
        pinWin.close()
      }
    })

    // 贴图窗口的拖拽实现（通过 page-title-updated 事件通信）
    let pinDragging = false
    let pinStartX = 0
    let pinStartY = 0
    let pinWinStartX = 0
    let pinWinStartY = 0

    // 16ms 轮询实现平滑拖拽
    const pinPoll = setInterval(() => {
      if (!pinDragging || pinWin.isDestroyed()) return
      const cursor = screen.getCursorScreenPoint()
      const dx = cursor.x - pinStartX
      const dy = cursor.y - pinStartY
      pinWin.setPosition(pinWinStartX + dx, pinWinStartY + dy)
    }, 16)

    // 注入拖拽和双击关闭的客户端脚本
    pinWin.webContents.on('did-finish-load', () => {
      pinWin.webContents.executeJavaScript(`
        let lastClick = 0;
        document.addEventListener('mousedown', (e) => {
          const now = Date.now();
          if (now - lastClick < 300) {
            // 双击关闭贴图
            document.title = '__PIN_CLOSE__';
            return;
          }
          lastClick = now;
          document.title = '__PIN_DRAG_START__' + e.screenX + ',' + e.screenY;
        });
        document.addEventListener('mouseup', () => {
          document.title = '__PIN_DRAG_END__';
        });
      `)
    })

    // 通过 title 变化实现贴图窗口的拖拽和关闭
    pinWin.on('page-title-updated', (event, title) => {
      event.preventDefault()
      if (title === '__PIN_CLOSE__') {
        pinWin.close()
      } else if (title.startsWith('__PIN_DRAG_START__')) {
        const parts = title.replace('__PIN_DRAG_START__', '').split(',')
        pinStartX = parseInt(parts[0])
        pinStartY = parseInt(parts[1])
        const [wx, wy] = pinWin.getPosition()
        pinWinStartX = wx
        pinWinStartY = wy
        pinDragging = true
      } else if (title === '__PIN_DRAG_END__') {
        pinDragging = false
      }
    })

    pinWin.on('closed', () => {
      clearInterval(pinPoll)
    })

    return true
  })

  // OCR 文字识别 - 将截图选区提交到离线 ONNX 模型进行文字提取
  ipcMain.handle('screenshot-ocr', async (_, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl)
      const bitmap = img.toBitmap()
      const { width, height } = img.getSize()
      // Electron bitmap 是 BGRA 格式，需转为 RGBA
      const rgba = new Uint8ClampedArray(bitmap.length)
      for (let i = 0; i < bitmap.length; i += 4) {
        rgba[i] = bitmap[i + 2]
        rgba[i + 1] = bitmap[i + 1]
        rgba[i + 2] = bitmap[i]
        rgba[i + 3] = bitmap[i + 3]
      }
      const imageData = { data: rgba, width, height, colorSpace: 'srgb' }
      const texts = await recognizeText(imageData)
      return { success: true, texts }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 翻译 - 将 OCR 提取的文字翻译为目标语言
  ipcMain.handle('screenshot-translate', async (_, { texts, from, to }) => {
    try {
      const result = await translateText(texts, from, to)
      return { success: true, texts: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
