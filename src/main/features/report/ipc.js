import { ipcMain, dialog } from 'electron'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { loadReportConfig, saveReportConfig, loadAiConfig } from '../../shared/store'

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
  const prompt = `你是一个工作报告生成助手。根据以下 git 提交记录，生成一份${typeLabel[type] || '报告'}。
要求：
- title 格式："YYYY-MM-DD ${typeLabel[type] || '报告'}" 或 "YYYY-MM-DD ~ YYYY-MM-DD ${typeLabel[type] || '报告'}"
- period 是时间范围
- summary 是 2-3 句话的整体工作摘要
- projects 按项目分组，每个 item 描述一项工作并标注类型
- next_plan 根据当前工作推测接下来可能要做的事（2-4条）
- 用中文回答`

  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `时间范围: ${dateRange.after} ~ ${dateRange.before}\n\n${gitLogs}` }
    ],
    temperature: 0.3,
    max_tokens: config.maxTokens,
    response_format: REPORT_SCHEMA
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
  return JSON.parse(content)
}

function reportToMarkdown(report) {
  let md = `# ${report.title}\n\n`
  md += `**时间范围：** ${report.period}\n\n`
  md += `## 工作摘要\n\n${report.summary}\n\n`
  md += `## 完成事项\n\n`
  for (const project of report.projects) {
    md += `### ${project.name}\n\n`
    for (const item of project.items) {
      const tag = `[${item.type}]`
      md += `- ${tag} ${item.description}\n`
    }
    md += '\n'
  }
  md += `## 下一步计划\n\n`
  for (const plan of report.next_plan) {
    md += `- ${plan}\n`
  }
  return md
}

export function setupReportIpc() {
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
}
