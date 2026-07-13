import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { createWriteStream, existsSync, statSync, unlinkSync, renameSync } from 'fs'
import { join } from 'path'
import { get as httpsGet } from 'https'
import { get as httpGet } from 'http'

let updateInfo = null
let updateState = { status: 'idle', percent: 0, version: '', error: '' }
let downloadAbortController = null

const TEMP_SUFFIX = '.download'
const MAX_RETRIES = 3
const RETRY_DELAY = 3000

function getDownloadDir() {
  return join(app.getPath('userData'), 'update-downloads')
}

function ensureDir(dir) {
  const { mkdirSync } = require('fs')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function getTempFilePath(fileName) {
  const dir = getDownloadDir()
  ensureDir(dir)
  return join(dir, fileName + TEMP_SUFFIX)
}

function getFinalFilePath(fileName) {
  const dir = getDownloadDir()
  ensureDir(dir)
  return join(dir, fileName)
}

function getExistingSize(filePath) {
  if (existsSync(filePath)) {
    return statSync(filePath).size
  }
  return 0
}

function downloadWithResume(url, fileName, totalSize, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const tempPath = getTempFilePath(fileName)
    const finalPath = getFinalFilePath(fileName)
    const existingSize = getExistingSize(tempPath)

    if (existsSync(finalPath) && statSync(finalPath).size === totalSize) {
      updateState.percent = 100
      broadcast('update-progress', { percent: 100, bytesPerSecond: 0, transferred: totalSize, total: totalSize })
      resolve(finalPath)
      return
    }

    if (existingSize >= totalSize && totalSize > 0) {
      unlinkSync(tempPath)
    }

    const headers = {}
    if (existingSize > 0 && totalSize > 0) {
      headers['Range'] = `bytes=${existingSize}-`
    }

    const getter = url.startsWith('https') ? httpsGet : httpGet
    const req = getter(url, { headers }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadWithResume(res.headers.location, fileName, totalSize, retryCount)
          .then(resolve)
          .catch(reject)
        return
      }

      if (res.statusCode === 416) {
        if (existsSync(tempPath)) unlinkSync(tempPath)
        downloadWithResume(url, fileName, totalSize, retryCount)
          .then(resolve)
          .catch(reject)
        return
      }

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        reject(new Error(`Download failed with status ${res.statusCode}`))
        return
      }

      const actualTotal = totalSize || parseInt(res.headers['content-length'] || '0', 10) + existingSize
      let transferred = existingSize

      const fileStream = createWriteStream(tempPath, { flags: existingSize > 0 ? 'a' : 'w' })
      let lastTime = Date.now()
      let lastTransferred = transferred

      res.on('data', (chunk) => {
        transferred += chunk.length
        const now = Date.now()
        const elapsed = (now - lastTime) / 1000

        let bytesPerSecond = 0
        if (elapsed >= 1) {
          bytesPerSecond = (transferred - lastTransferred) / elapsed
          lastTime = now
          lastTransferred = transferred
        }

        const percent = actualTotal > 0 ? (transferred / actualTotal) * 100 : 0
        updateState.percent = percent
        broadcast('update-progress', {
          percent,
          bytesPerSecond,
          transferred,
          total: actualTotal
        })
      })

      res.pipe(fileStream)

      fileStream.on('finish', () => {
        if (transferred >= actualTotal && actualTotal > 0) {
          renameSync(tempPath, finalPath)
          resolve(finalPath)
        } else if (actualTotal === 0) {
          renameSync(tempPath, finalPath)
          resolve(finalPath)
        } else {
          retryDownload(url, fileName, totalSize, retryCount, resolve, reject)
        }
      })

      res.on('error', (err) => {
        fileStream.close()
        retryDownload(url, fileName, totalSize, retryCount, resolve, reject, err)
      })

      fileStream.on('error', (err) => {
        reject(err)
      })
    })

    req.on('error', (err) => {
      retryDownload(url, fileName, totalSize, retryCount, resolve, reject, err)
    })

    downloadAbortController = { abort: () => req.destroy() }
  })
}

function retryDownload(url, fileName, totalSize, retryCount, resolve, reject, err) {
  if (retryCount < MAX_RETRIES) {
    setTimeout(() => {
      downloadWithResume(url, fileName, totalSize, retryCount + 1)
        .then(resolve)
        .catch(reject)
    }, RETRY_DELAY * (retryCount + 1))
  } else {
    reject(err || new Error('Download failed after max retries'))
  }
}

export function setupUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.forceCodeSigning = false

  autoUpdater.on('update-available', (info) => {
    updateInfo = info
    updateState = { status: 'downloading', percent: 0, version: info.version, error: '' }
    broadcast('update-available', { version: info.version, releaseNotes: info.releaseNotes })

    let file
    if (process.platform === 'darwin') {
      file = info.files.find((f) => f.url.endsWith('.dmg')) ||
             info.files.find((f) => f.url.endsWith('.zip'))
    } else if (process.platform === 'win32') {
      file = info.files.find((f) => f.url.endsWith('.exe'))
    } else {
      file = info.files.find((f) => f.url.endsWith('.AppImage') || f.url.endsWith('.deb'))
    }

    if (!file) {
      updateState = { status: 'error', percent: 0, version: info.version, error: 'No suitable update file found' }
      broadcast('update-error', { message: 'No suitable update file found' })
      return
    }

    const baseUrl = `https://github.com/rong-chen/desktop-cat/releases/download/v${info.version}/`
    const downloadUrl = baseUrl + file.url
    const fileSize = file.size || 0

    downloadWithResume(downloadUrl, file.url, fileSize)
      .then((filePath) => {
        updateState = { status: 'downloaded', percent: 100, version: info.version, error: '' }
        broadcast('update-downloaded', { version: info.version, filePath })
      })
      .catch((err) => {
        updateState = { status: 'error', percent: 0, version: info.version, error: err.message }
        broadcast('update-error', { message: err.message })
      })
  })

  autoUpdater.on('update-not-available', () => {
    updateState = { status: 'up-to-date', percent: 0, version: '', error: '' }
    broadcast('update-not-available')
  })

  autoUpdater.on('error', (err) => {
    if (updateState.status !== 'downloading') {
      updateState = { status: 'error', percent: 0, version: updateState.version, error: err.message }
      broadcast('update-error', { message: err.message })
    }
  })

  ipcMain.handle('check-for-update', () => {
    return autoUpdater.checkForUpdates().catch(() => null)
  })

  ipcMain.handle('get-update-state', () => {
    return updateState
  })

  ipcMain.handle('install-update', async () => {
    const dir = getDownloadDir()
    if (updateInfo) {
      let file
      if (process.platform === 'darwin') {
        file = updateInfo.files.find((f) => f.url.endsWith('.dmg')) ||
               updateInfo.files.find((f) => f.url.endsWith('.zip'))
      } else if (process.platform === 'win32') {
        file = updateInfo.files.find((f) => f.url.endsWith('.exe'))
      } else {
        file = updateInfo.files.find((f) => f.url.endsWith('.AppImage') || f.url.endsWith('.deb'))
      }
      if (file) {
        const finalPath = join(dir, file.url)
        if (existsSync(finalPath)) {
          if (process.platform === 'darwin' && file.url.endsWith('.dmg')) {
            await shell.openPath(finalPath)
            return
          }
          autoUpdater.quitAndInstall(false, true)
          return
        }
      }
    }
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('cancel-update-download', () => {
    if (downloadAbortController) {
      downloadAbortController.abort()
      downloadAbortController = null
      updateState = { status: 'idle', percent: 0, version: updateState.version, error: '' }
      broadcast('update-error', { message: 'Download cancelled' })
    }
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