import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow } from 'electron'

let updateInfo = null

export function setupUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    updateInfo = info
    broadcast('update-available', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast('update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast('update-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', () => {
    broadcast('update-downloaded', { version: updateInfo?.version })
  })

  autoUpdater.on('error', (err) => {
    broadcast('update-error', { message: err.message })
  })

  ipcMain.handle('check-for-update', () => {
    return autoUpdater.checkForUpdates().catch(() => null)
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
