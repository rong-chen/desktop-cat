import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { app } from 'electron'
import { appIcon } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'

let jsonViewerWindow = null

const cacheDir = join(app.getPath('userData'), 'json-viewer')
const cacheFile = join(cacheDir, 'tabs-cache.json')

function loadCache() {
  try {
    if (existsSync(cacheFile)) {
      return JSON.parse(readFileSync(cacheFile, 'utf-8'))
    }
  } catch {}
  return null
}

function saveCache(data) {
  try {
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true })
    }
    writeFileSync(cacheFile, JSON.stringify(data), 'utf-8')
  } catch {}
}

export function openJsonViewerWindow(jsonContent) {
  if (jsonViewerWindow && !jsonViewerWindow.isDestroyed()) {
    jsonViewerWindow.focus()
    if (jsonContent) {
      jsonViewerWindow.webContents.send('json-viewer-open-tab', jsonContent)
    }
    return
  }

  jsonViewerWindow = new BrowserWindow({
    width: 1350,
    height: 1050,
    title: 'JSON 查看器 - Desktop Cat',
    icon: appIcon,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(jsonViewerWindow, 'json-viewer/index.html')

  if (jsonContent) {
    jsonViewerWindow.webContents.once('did-finish-load', () => {
      jsonViewerWindow.webContents.send('json-viewer-open-tab', jsonContent)
    })
  }

  jsonViewerWindow.on('closed', () => {
    jsonViewerWindow = null
  })
}

export function getJsonViewerWindow() {
  return jsonViewerWindow
}

export function registerJsonViewerIpc() {
  ipcMain.handle('json-viewer-load-cache', () => loadCache())
  ipcMain.handle('json-viewer-save-cache', (_, data) => saveCache(data))
}
