/**
 * 定时任务 IPC 通信模块
 * 处理任务的增删改查及测试执行
 */

import { ipcMain, dialog } from 'electron'
import { loadTasks, saveTasks, loadTaskLogs } from '../../shared/store'
import { scheduleTask, executeTask, testExecuteTask, getScheduledJobs } from './scheduler'

/** 注册定时任务相关 IPC 处理器 */
export function setupTasksIpc() {
  // 获取所有任务列表
  ipcMain.handle('get-tasks', () => loadTasks())

  // 添加新任务
  ipcMain.handle('add-task', (_, task) => {
    const tasks = loadTasks()
    task.id = Date.now().toString()
    tasks.push(task)
    saveTasks(tasks)
    scheduleTask(task)
    return tasks
  })

  // 更新已有任务
  ipcMain.handle('update-task', (_, task) => {
    const tasks = loadTasks()
    const idx = tasks.findIndex((t) => t.id === task.id)
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...task }
      saveTasks(tasks)
      scheduleTask(tasks[idx])
    }
    return tasks
  })

  // 切换任务启用/禁用状态
  ipcMain.handle('toggle-task', (_, id) => {
    const tasks = loadTasks()
    const task = tasks.find((t) => t.id === id)
    if (task) {
      task.enabled = !task.enabled
      saveTasks(tasks)
      scheduleTask(task)
    }
    return tasks
  })

  // 删除任务
  ipcMain.handle('delete-task', (_, id) => {
    let tasks = loadTasks()
    tasks = tasks.filter((t) => t.id !== id)
    saveTasks(tasks)
    const jobs = getScheduledJobs()
    if (jobs[id]) {
      jobs[id].stop()
      delete jobs[id]
    }
    return tasks
  })

  // 选择应用程序（用于"打开应用"类型任务）
  ipcMain.handle('select-app', async () => {
    const isMacPlatform = process.platform === 'darwin'
    const isWin = process.platform === 'win32'
    const result = await dialog.showOpenDialog({
      title: '选择应用',
      defaultPath: isMacPlatform ? '/Applications' : isWin ? 'C:\\Program Files' : '/usr/bin',
      properties: isMacPlatform ? ['openFile', 'treatPackageAsDirectory'] : ['openFile'],
      filters: isMacPlatform
        ? [{ name: '应用程序', extensions: ['app'] }]
        : isWin
          ? [{ name: '可执行文件', extensions: ['exe', 'lnk', 'bat', 'cmd'] }]
          : [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 立即测试执行一次任务，返回执行结果
  ipcMain.handle('test-task', async (_, task) => {
    return await testExecuteTask(task)
  })

  // 选择脚本文件（用于"执行脚本"类型任务）
  ipcMain.handle('select-script', async () => {
    const isMac = process.platform === 'darwin'
    const isWin = process.platform === 'win32'
    const result = await dialog.showOpenDialog({
      title: '选择脚本文件',
      properties: ['openFile'],
      filters: isWin
        ? [{ name: '脚本文件', extensions: ['bat', 'cmd', 'ps1', 'vbs', 'sh', 'py'] }]
        : isMac
          ? [{ name: '脚本文件', extensions: ['sh', 'command', 'py', 'rb'] }]
          : [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 选择工作目录（用于"执行脚本"类型任务）
  ipcMain.handle('select-script-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择工作目录',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 获取任务执行日志
  ipcMain.handle('get-task-logs', (_, taskId) => {
    return loadTaskLogs(taskId)
  })
}
