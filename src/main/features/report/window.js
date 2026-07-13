import { BrowserWindow } from 'electron'
import { appIcon } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'

let reportWindow = null

export function openReportWindow() {
  if (reportWindow && !reportWindow.isDestroyed()) {
    reportWindow.focus()
    return
  }

  reportWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: '工作报告 - Desktop Cat',
    icon: appIcon,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(reportWindow, 'report/index.html')

  reportWindow.on('closed', () => {
    reportWindow = null
  })
}

export function getReportWindow() {
  return reportWindow
}
