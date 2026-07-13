import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

let updateInfo = null
let updateState = { status: 'idle', percent: 0, version: '', error: '' }

export function setupUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.forceCodeSigning = false

  autoUpdater.on('update-available', (info) => {
    updateInfo = info
    updateState = { status: 'downloading', percent: 0, version: info.version, error: '' }
    broadcast('update-available', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    updateState = { status: 'up-to-date', percent: 0, version: '', error: '' }
    broadcast('update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    updateState.percent = progress.percent
    broadcast('update-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', () => {
    updateState = { status: 'downloaded', percent: 100, version: updateInfo?.version, error: '' }
    broadcast('update-downloaded', { version: updateInfo?.version })
  })

  autoUpdater.on('error', (err) => {
    updateState = { status: 'error', percent: 0, version: updateState.version, error: err.message }
    broadcast('update-error', { message: err.message })
  })

  ipcMain.handle('check-for-update', () => {
    return autoUpdater.checkForUpdates().catch(() => null)
  })

  ipcMain.handle('get-update-state', () => {
    return updateState
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  autoUpdater.checkForUpdates().catch(() => {})

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

function broadcast(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
