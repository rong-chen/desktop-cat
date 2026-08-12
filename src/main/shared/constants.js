/**
 * 全局常量定义
 * 包含平台判断、应用图标路径、默认配置等
 */

import { join } from 'path'

// 平台判断
export const isMac = process.platform === 'darwin'

// 应用图标路径
export const appIcon = join(__dirname, '../../resources/icon.png')

// 默认全局快捷键配置
export const defaultShortcuts = {
  toggleCat: 'CommandOrControl+Shift+C',
  openSettings: 'CommandOrControl+Shift+,',
  screenshot: 'F1',
  openClipboard: 'F2',
  openJsonViewer: 'F3',
  openTasks: 'F4'
}

// AI 配置默认值
export const defaultAiConfig = {
  mode: 'off', // off: 关闭 | decompress: 解压模式 | chat: 话唠模式
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
  stream: true,
  temperature: 0.7,
  maxTokens: 2048
}

// 聊天气泡窗口尺寸常量
export const CHAT_W = 220
export const CHAT_H = 320
export const CHAT_OFFSET = 2
