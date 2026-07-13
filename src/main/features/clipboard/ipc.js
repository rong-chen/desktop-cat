/**
 * 剪贴板功能 IPC 通信模块
 * 处理剪贴板历史的增删查改操作
 */

import { ipcMain, clipboard, nativeImage, screen, BrowserWindow } from 'electron'
import { getClipboardHistory, setClipboardHistory, saveClipboard } from '../../shared/store'

/** 注册剪贴板相关 IPC 处理器 */
export function setupClipboardIpc() {
  // 获取剪贴板历史列表
  ipcMain.handle('get-clipboard-history', () => getClipboardHistory())

  // 清空所有历史记录
  ipcMain.handle('clear-clipboard-history', () => {
    setClipboardHistory([])
    saveClipboard()
    return true
  })

  // 删除指定索引的历史记录
  ipcMain.handle('delete-clipboard-item', (_, index) => {
    const history = getClipboardHistory()
    history.splice(index, 1)
    saveClipboard()
    return history
  })

  // 复制指定条目到剪贴板（支持文本和图片）
  ipcMain.handle('copy-clipboard-item', (_, item) => {
    if (item.type === 'image') {
      const img = nativeImage.createFromDataURL(item.dataUrl)
      clipboard.writeImage(img)
    } else {
      clipboard.writeText(item.text || item)
    }
    return true
  })

  // 打开独立窗口预览图片
  ipcMain.on('open-image-preview', (_, dataUrl) => {
    const display = screen.getPrimaryDisplay()
    const { width, height } = display.workAreaSize

    const winW = Math.min(width - 100, 1200)
    const winH = Math.min(height - 100, 900)

    const previewWin = new BrowserWindow({
      width: winW,
      height: winH,
      center: true,
      title: '图片预览',
      backgroundColor: '#1a1a1a',
      alwaysOnTop: true,
      autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    })

    const html = `<!DOCTYPE html><html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#1a1a1a;display:flex;align-items:center;justify-content:center;height:100vh;overflow:hidden}
      img{max-width:100%;max-height:100vh;object-fit:contain;cursor:zoom-in}
      img.zoomed{max-width:none;max-height:none;cursor:zoom-out}
      body.scrollable{overflow:auto}
    </style></head><body>
      <img id="img" src="${dataUrl}" onclick="toggle()" />
      <script>
        function toggle(){
          const img=document.getElementById('img');
          img.classList.toggle('zoomed');
          document.body.classList.toggle('scrollable');
        }
      </script>
    </body></html>`

    previewWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}
