import { ipcMain, dialog } from 'electron'
import { execSync } from 'child_process'
import { writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { loadReportConfig, saveReportConfig, loadAiConfig } from '../../shared/store'
import { openReportWindow } from './window'

const REPORT_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'git_report',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '报告标题' },
        period: { type: 'string', description: '时间范围' },
        summary: { type: 'string', description: '整体工作摘要，2-3句话' },
        projects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '项目名称' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string', description: '工作内容描述' },
                    type: { type: 'string', enum: ['feature', 'fix', 'refactor', 'docs', 'other'] }
                  },
                  required: ['description', 'type'],
                  additionalProperties: false
                }
              }
            },
            required: ['name', 'items'],
            additionalProperties: false
          }
        },
        next_plan: {
          type: 'array',
          items: { type: 'string' },
          description: '下一步计划'
        }
      },
      required: ['title', 'period', 'summary', 'projects', 'next_plan'],
      additionalProperties: false
    }
  }
}

function getDateRange(type, customRange) {
  const now = new Date()
  let after, before

  if (type === 'daily') {
    after = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    before = new Date(after.getTime() + 86400000)
  } else if (type === 'weekly') {
    const day = now.getDay() || 7
    after = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1)
    before = new Date(now.getTime() + 86400000)
  } else if (type === 'monthly') {
    after = new Date(now.getFullYear(), now.getMonth(), 1)
    before = new Date(now.getTime() + 86400000)
  } else {
    after = new Date(customRange.start)
    before = new Date(customRange.end)
    before = new Date(before.getTime() + 86400000)
  }

  const fmt = (d) => d.toISOString().split('T')[0]
  return { after: fmt(after), before: fmt(before) }
}

function getGitLog(projectPath, author, after, before) {
  try {
    let cmd = `git -C "${projectPath}" log --after="${after}" --before="${before}" --oneline --no-merges`
    if (author) cmd += ` --author="${author}"`
    return execSync(cmd, { encoding: 'utf-8', timeout: 10000 }).trim()
  } catch {
    return ''
  }
}

async function callAiForReport(gitLogs, type, dateRange, config) {
  const typeLabel = { daily: '日报', weekly: '周报', monthly: '月报', custom: '报告' }
  const prompt = `根据以下 git commit 记录，按项目分组生成工作内容列表，用于填写${typeLabel[type] || '报告'}。
要求：
- 按项目分组，合并相似的提交
- 每条简洁明了
- 用中文回答
- 返回纯 JSON，格式：
{"projects":[{"name":"项目名","items":["完成xxx","修复xxx"]}]}`

  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `时间范围: ${dateRange.after} ~ ${dateRange.before}\n\n${gitLogs}` }
    ],
    temperature: 0.3,
    max_tokens: config.maxTokens,
    response_format: { type: 'json_object' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI 请求失败: ${res.status} ${text}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回内容为空')
  const finishReason = data.choices?.[0]?.finish_reason
  if (finishReason === 'length') {
    throw new Error('AI 返回内容被截断，请减少项目数量或缩短时间范围后重试')
  }
  return JSON.parse(content)
}

function reportToMarkdown(report) {
  if (report.projects) {
    let md = ''
    for (const project of report.projects) {
      md += `${project.name}：\n`
      project.items.forEach((item, i) => {
        md += `${i + 1}. ${item}\n`
      })
      md += '\n'
    }
    return md.trim()
  }
  return JSON.stringify(report, null, 2)
}

export function setupReportIpc() {
  ipcMain.on('open-report', () => openReportWindow())

  ipcMain.handle('get-report-config', () => loadReportConfig())

  ipcMain.handle('save-report-config', (_, config) => {
    saveReportConfig(config)
    return true
  })

  ipcMain.handle('select-project-dir', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择 Git 项目目录'
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('generate-report', async (_, { type, projects, gitUser, customRange }) => {
    const aiConfig = loadAiConfig()
    if (!aiConfig.apiKey) throw new Error('请先配置 AI API Key')

    const dateRange = getDateRange(type, customRange)
    let allLogs = ''

    for (const project of projects) {
      const log = getGitLog(project.path, gitUser, dateRange.after, dateRange.before)
      if (log) {
        allLogs += `\n## 项目: ${project.name} (${project.path})\n${log}\n`
      }
    }

    if (!allLogs.trim()) {
      throw new Error('所选时间范围内没有找到任何 git 提交记录')
    }

    const report = await callAiForReport(allLogs, type, dateRange, aiConfig)
    // 持久化生成结果
    const reportConfig = loadReportConfig()
    reportConfig.lastReport = report
    saveReportConfig(reportConfig)
    return report
  })

  ipcMain.handle('export-report', async (_, report) => {
    const md = reportToMarkdown(report)
    const result = await dialog.showSaveDialog({
      title: '导出报告',
      defaultPath: `${report.title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, md, 'utf-8')
    return true
  })

  ipcMain.handle('scan-projects', async (_, parentDir) => {
    if (!parentDir || !existsSync(parentDir)) return []
    const results = []

    function scan(dir, depth) {
      if (depth > 3) return
      try {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          if (entry.startsWith('.')) continue
          const fullPath = join(dir, entry)
          try {
            const stat = statSync(fullPath)
            if (!stat.isDirectory()) continue
            if (existsSync(join(fullPath, '.git'))) {
              results.push({ name: entry, path: fullPath })
            } else {
              scan(fullPath, depth + 1)
            }
          } catch {
            // skip inaccessible
          }
        }
      } catch {
        // skip
      }
    }

    // 先检查选中的目录本身是不是 git 仓库
    if (existsSync(join(parentDir, '.git'))) {
      results.push({ name: basename(parentDir), path: parentDir })
    } else {
      scan(parentDir, 0)
    }

    return results
  })
}

/**
 * 自动执行 Git 报告生成（供定时任务调度器调用）
 * 返回生成的报告对象，同时持久化到 reportConfig
 */
export async function runGitReport(reportType) {
  const reportConfig = loadReportConfig()
  const aiConfig = loadAiConfig()
  if (!aiConfig.apiKey) return null

  const projects = reportConfig.projects || []
  if (projects.length === 0) return null

  const dateRange = getDateRange(reportType || 'daily', null)
  let allLogs = ''

  for (const project of projects) {
    const log = getGitLog(project.path, reportConfig.gitUser, dateRange.after, dateRange.before)
    if (log) {
      allLogs += `\n## 项目: ${project.name} (${project.path})\n${log}\n`
    }
  }

  if (!allLogs.trim()) return null

  const report = await callAiForReport(allLogs, reportType || 'daily', dateRange, aiConfig)
  reportConfig.lastReport = report
  saveReportConfig(reportConfig)
  return report
}
