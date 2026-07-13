/**
 * 定时任务调度模块
 * 使用 node-cron 实现任务调度，支持工作日/休息日过滤
 */

import { shell } from 'electron'
import { spawn, execSync } from 'child_process'
import { existsSync } from 'fs'
import cron from 'node-cron'
import { loadTasks, appendTaskLog, loadReportConfig } from '../../shared/store'
import { checkIsWorkday } from '../../shared/holiday'
import { showNotifyWindow } from '../notify/window'
import { runGitReport } from '../report/ipc'

function getGitBashPath() {
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'D:\\Git\\bin\\bash.exe'
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  try {
    const gitPath = execSync('where git', { encoding: 'utf-8' }).trim().split('\n')[0]
    const bashPath = gitPath.replace(/cmd\\git\.exe$/i, 'bin\\bash.exe').replace(/\\git\.exe$/i, '\\bash.exe')
    if (existsSync(bashPath)) return bashPath
  } catch {}
  return 'bash'
}

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
 * 支持类型：notification（全屏通知）、open-app（打开应用）、run-script（执行脚本）
 */
export async function executeTask(task) {
  if (task.type === 'notification') {
    showNotifyWindow(task.message || task.name)
  } else if (task.type === 'open-app') {
    if (task.appPath) {
      shell.openPath(task.appPath)
    }
  } else if (task.type === 'run-script') {
    if (task.scriptArgs) {
      if (task.enableGitReport) {
        await runGitReport(task.gitReportType || 'daily')
      }
      runScript(task)
    }
  }
}

function runScript(task, returnResult = false) {
  const isWin = process.platform === 'win32'
  const startTime = Date.now()

  const reportConfig = loadReportConfig()
  const projects = reportConfig.projects || []
  const lastReport = reportConfig.lastReport

  // 变量替换：支持项目配置变量和报告结果变量
  function replaceVars(str) {
    if (!str) return str
    let result = str
    result = result.replace(/\$\{gitUser\}/g, reportConfig.gitUser || '')
    result = result.replace(/\$\{allProjectPaths\}/g, projects.map((p) => p.path).join(','))
    result = result.replace(/\$\{allProjectNames\}/g, projects.map((p) => p.name).join(','))
    result = result.replace(/\$\{projectPath_(\d+)\}/g, (_, idx) => {
      const p = projects[parseInt(idx)]
      return p ? p.path : ''
    })
    result = result.replace(/\$\{projectName_(\d+)\}/g, (_, idx) => {
      const p = projects[parseInt(idx)]
      return p ? p.name : ''
    })
    // 报告结果变量
    if (lastReport && lastReport.projects) {
      const reportText = lastReport.projects.map((p) => {
        return `${p.name}：\n${p.items.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
      }).join('\n\n')
      result = result.replace(/\$\{report\}/g, reportText)
    } else {
      result = result.replace(/\$\{report\}/g, '')
    }
    return result
  }

  const command = replaceVars(task.scriptArgs)
  if (!command) {
    if (returnResult) return Promise.resolve({ exitCode: -1, stdout: '', stderr: '执行命令为空', duration: 0 })
    return
  }

  let cmd, args
  const usesBash = command.trim().startsWith('bash ') || command.trim().endsWith('.sh')

  if (isWin) {
    if (usesBash) {
      const gitBash = getGitBashPath()
      cmd = gitBash
      args = ['-c', command]
    } else {
      cmd = 'cmd.exe'
      args = ['/c', command]
    }
  } else {
    cmd = '/bin/sh'
    args = ['-c', command]
  }

  const child = spawn(cmd, args, {
    cwd: task.scriptPath || undefined,
    env: process.env,
    windowsHide: true
  })

  let stdout = ''
  let stderr = ''

  child.stdout.on('data', (data) => {
    stdout += data.toString()
  })

  child.stderr.on('data', (data) => {
    stderr += data.toString()
  })

  const promise = new Promise((resolve) => {
    child.on('close', (exitCode) => {
      const duration = Date.now() - startTime
      const log = {
        taskId: task.id,
        taskName: task.name,
        time: new Date().toISOString(),
        exitCode,
        stdout: stdout.slice(0, 5000),
        stderr: stderr.slice(0, 5000),
        duration
      }
      appendTaskLog(log)
      resolve(log)
    })

    child.on('error', (err) => {
      const duration = Date.now() - startTime
      const log = {
        taskId: task.id,
        taskName: task.name,
        time: new Date().toISOString(),
        exitCode: -1,
        stdout: '',
        stderr: err.message,
        duration
      }
      appendTaskLog(log)
      resolve(log)
    })
  })

  if (returnResult) return promise
}

/**
 * 测试执行任务并返回结果（用于 UI 测试按钮）
 */
export async function testExecuteTask(task) {
  if (task.type === 'run-script') {
    if (!task.scriptArgs) return { exitCode: -1, stdout: '', stderr: '执行命令为空', duration: 0 }
    if (task.enableGitReport) {
      await runGitReport(task.gitReportType || 'daily')
    }
    return runScript(task, true)
  }
  executeTask(task)
  return { exitCode: 0, stdout: '执行成功', stderr: '', duration: 0 }
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
