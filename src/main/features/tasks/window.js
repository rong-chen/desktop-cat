/**
 * 定时任务管理窗口模块
 * 提供 cron 定时任务的创建、编辑和管理界面
 */

import { BrowserWindow } from 'electron'
import { appIcon, isMac } from '../../shared/constants'
import { subWindowOptions, loadWindowUrl, getPreloadPath } from '../../shared/window-utils'

let tasksWindow = null

/** 打开定时任务管理窗口（单例） */
export function openTasksWindow() {
  if (tasksWindow && !tasksWindow.isDestroyed()) {
    tasksWindow.focus()
    return
  }

  tasksWindow = new BrowserWindow({
    width: 700,
    height: 550,
    title: '定时任务 - Desktop Cat',
    icon: appIcon,
    type: isMac ? 'panel' : undefined,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false
    }
  })

  loadWindowUrl(tasksWindow, 'tasks/index.html')

  tasksWindow.on('closed', () => {
    tasksWindow = null
  })
}

/** 获取定时任务窗口实例 */
export function getTasksWindow() {
  return tasksWindow
}
