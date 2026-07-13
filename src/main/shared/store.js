/**
 * 数据持久化模块
 * 负责所有本地数据文件的读写操作（剪贴板、快捷键、任务、AI 配置）
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { defaultShortcuts, defaultAiConfig } from './constants'

// 数据文件路径
const dataDir = join(app.getPath('userData'), 'data')
const clipboardFile = join(dataDir, 'clipboard.json')
const shortcutsFile = join(dataDir, 'shortcuts.json')
const tasksFile = join(dataDir, 'tasks.json')
const aiConfigFile = join(dataDir, 'ai-config.json')

// 内存中的剪贴板历史
let clipboardHistory = []

/** 获取剪贴板历史数组 */
export function getClipboardHistory() {
  return clipboardHistory
}

/** 设置剪贴板历史数组 */
export function setClipboardHistory(history) {
  clipboardHistory = history
}

/** 初始化数据目录并加载剪贴板历史 */
export function loadData() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (existsSync(clipboardFile)) {
    try {
      const data = JSON.parse(readFileSync(clipboardFile, 'utf-8'))
      clipboardHistory = data.map(item => {
        if (!item.type) return { type: 'text', text: item.text, time: item.time }
        return item
      })
    } catch (e) {
      clipboardHistory = []
    }
  }
}

/** 保存剪贴板历史到本地文件 */
export function saveClipboard() {
  writeFileSync(clipboardFile, JSON.stringify(clipboardHistory, null, 2))
}

/** 加载快捷键配置，不存在则返回默认值 */
export function loadShortcuts() {
  if (existsSync(shortcutsFile)) {
    try {
      return JSON.parse(readFileSync(shortcutsFile, 'utf-8'))
    } catch (e) {
      return { ...defaultShortcuts }
    }
  }
  return { ...defaultShortcuts }
}

/** 保存快捷键配置到本地文件 */
export function saveShortcuts(shortcuts) {
  writeFileSync(shortcutsFile, JSON.stringify(shortcuts, null, 2))
}

/** 加载定时任务列表 */
export function loadTasks() {
  if (existsSync(tasksFile)) {
    try {
      return JSON.parse(readFileSync(tasksFile, 'utf-8'))
    } catch (e) {
      return []
    }
  }
  return []
}

/** 保存定时任务列表到本地文件 */
export function saveTasks(tasks) {
  writeFileSync(tasksFile, JSON.stringify(tasks, null, 2))
}

/** 加载 AI 配置，与默认配置合并确保字段完整 */
export function loadAiConfig() {
  if (existsSync(aiConfigFile)) {
    try {
      return { ...defaultAiConfig, ...JSON.parse(readFileSync(aiConfigFile, 'utf-8')) }
    } catch (e) {
      return { ...defaultAiConfig }
    }
  }
  return { ...defaultAiConfig }
}

/** 保存 AI 配置到本地文件 */
export function saveAiConfig(config) {
  writeFileSync(aiConfigFile, JSON.stringify(config, null, 2))
}
