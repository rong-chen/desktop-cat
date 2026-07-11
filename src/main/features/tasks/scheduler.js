/**
 * 定时任务调度模块
 * 使用 node-cron 实现任务调度，支持工作日/休息日过滤
 */

import { shell } from 'electron'
import cron from 'node-cron'
import { loadTasks } from '../../shared/store'
import { checkIsWorkday } from '../../shared/holiday'
import { showNotifyWindow } from '../notify/window'

// cron 定时任务实例映射 { taskId: cronJob }
let scheduledJobs = {}

/**
 * 调度单个定时任务
 * 如果任务已存在则先停止旧任务，再根据 cron 表达式重新注册
 * 支持 dayMode 过滤：workday（仅工作日）/ holiday（仅休息日）/ all（每天）
 */
export function scheduleTask(task) {
  if (scheduledJobs[task.id]) {
    scheduledJobs[task.id].stop()
    delete scheduledJobs[task.id]
  }

  if (!task.enabled || !cron.validate(task.cron)) return

  scheduledJobs[task.id] = cron.schedule(task.cron, async () => {
    if (task.dayMode && task.dayMode !== 'all') {
      const workday = await checkIsWorkday()
      if (task.dayMode === 'workday' && !workday) return
      if (task.dayMode === 'holiday' && workday) return
    }
    executeTask(task)
  })
}

/**
 * 执行定时任务的具体动作
 * 支持类型：notification（全屏通知）、open-app（打开应用）
 */
export function executeTask(task) {
  if (task.type === 'notification') {
    showNotifyWindow(task.message || task.name)
  } else if (task.type === 'open-app') {
    if (task.appPath) {
      shell.openPath(task.appPath)
    }
  }
}

/**
 * 加载并调度所有定时任务
 * 先停止所有旧任务，再重新注册
 */
export function scheduleAllTasks() {
  Object.values(scheduledJobs).forEach((job) => job.stop())
  scheduledJobs = {}
  const tasks = loadTasks()
  tasks.forEach((task) => scheduleTask(task))
}

/** 停止所有定时任务（用于退出时清理） */
export function stopAllTasks() {
  Object.values(scheduledJobs).forEach((job) => job.stop())
}

/** 获取调度任务映射 */
export function getScheduledJobs() {
  return scheduledJobs
}
