/**
 * AI 聊天服务模块
 * 负责 AI 对话的流式/非流式请求、问候语、随机笑话等功能
 */

import { loadAiConfig, saveAiConfig } from '../../shared/store'
import { getChatWindow, showChat } from './window'

// 聊天气泡自动隐藏定时器
let chatHideTimer = null
// 聊天菜单延迟隐藏定时器
let chatMenuTimer = null
// 随机笑话定时器
let jokeTimer = null
// 倒计时暂停/恢复状态
let chatHideRemaining = 0
let chatHideStartedAt = 0
// 当前是否有文字在显示
let hasActiveText = false
// 当前是否处于暂停状态（鼠标在气泡上）
let isPaused = false

/** 获取当前是否有文字在显示 */
export function getHasActiveText() { return hasActiveText }

/** 获取隐藏定时器 */
export function getChatHideTimer() { return chatHideTimer }
/** 设置隐藏定时器 */
export function setChatHideTimer(timer) { chatHideTimer = timer }
/** 获取菜单定时器 */
export function getChatMenuTimer() { return chatMenuTimer }
/** 设置菜单定时器 */
export function setChatMenuTimer(timer) { chatMenuTimer = timer }

/**
 * 延迟隐藏聊天气泡
 * @param {number} delay - 延迟时间（毫秒），默认 5000ms
 */
export function scheduleChatHide(delay) {
  if (chatHideTimer) clearTimeout(chatHideTimer)
  hasActiveText = true
  chatHideRemaining = delay || 5000
  chatHideStartedAt = Date.now()
  if (isPaused) return
  chatHideTimer = setTimeout(() => {
    chatHideTimer = null
    chatHideRemaining = 0
    hasActiveText = false
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) {
      chatWin.hide()
    }
  }, chatHideRemaining)
}

/** 暂停隐藏倒计时 */
export function pauseChatHide() {
  isPaused = true
  if (!chatHideTimer) return
  clearTimeout(chatHideTimer)
  chatHideTimer = null
  const elapsed = Date.now() - chatHideStartedAt
  chatHideRemaining = Math.max(0, chatHideRemaining - elapsed)
}

/** 恢复隐藏倒计时 */
export function resumeChatHide() {
  isPaused = false
  if (chatHideTimer) return
  if (chatHideRemaining <= 0) {
    // 倒计时早已结束，直接隐藏
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) {
      chatWin.hide()
    }
    return
  }
  chatHideStartedAt = Date.now()
  chatHideTimer = setTimeout(() => {
    chatHideTimer = null
    chatHideRemaining = 0
    hasActiveText = false
    const chatWin = getChatWindow()
    if (chatWin && !chatWin.isDestroyed()) {
      chatWin.hide()
    }
  }, chatHideRemaining)
}

/**
 * 发送开机问候语
 * 根据 AI 模式（decompress/chat）生成不同风格的问候
 * 支持流式和非流式两种响应方式
 */
export async function sendChatGreeting() {
  const config = loadAiConfig()
  if (config.mode === 'off' || !config.apiKey || !config.baseUrl) {
    return
  }

  const systemPrompt =
    config.mode === 'decompress'
      ? '你是一只可爱的桌面猫咪，负责帮用户解压放松。用温暖、轻松、活泼的语气说一句话，可以是鼓励或讲一个小笑话。控制在50字以内。禁止使用括号标注动作或语气，如(撒娇)(害羞)等，直接说话即可。'
      : '你是一只话唠桌面猫咪，喜欢跟主人聊天。用活泼、俏皮的语气随便说点什么，可以分享冷知识、吐槽天气。控制在50字以内。禁止使用括号标注动作或语气，如(撒娇)(害羞)等，直接说话即可。'

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '跟我打个招呼吧' }
  ]

  await streamChat(messages, config, { hideDelay: 5000 })
}

/**
 * 调度下一次随机笑话
 * 间隔为 5分钟 ~ 60分钟 之间的随机时间
 */
export function scheduleRandomJoke() {
  if (jokeTimer) clearTimeout(jokeTimer)
  const min = 10 * 60 * 1000
  const max = 60 * 60 * 1000
  const delay = Math.floor(Math.random() * (max - min)) + min
  jokeTimer = setTimeout(() => {
    sendRandomJoke()
  }, delay)
}

/** 停止随机笑话定时器 */
export function stopRandomJoke() {
  if (jokeTimer) {
    clearTimeout(jokeTimer)
    jokeTimer = null
  }
}

/**
 * 发送随机笑话（仅在解压模式下生效）
 * 随机选取不同类型的笑话 prompt，调用 AI 生成笑话内容
 * 笑话显示 15 秒后自动隐藏，然后调度下一次笑话
 */
async function sendRandomJoke() {
  const config = loadAiConfig()
  if (config.mode !== 'decompress' || !config.apiKey || !config.baseUrl) {
    return
  }

  const systemPrompt =
    '你是一只会讲笑话的桌面猫咪。请讲一个笑话，可以是冷笑话、经典笑话、谐音梗、脑筋急转弯、段子等任何类型。要求有趣、有梗，控制在100字以内。每次讲不同类型不同内容的笑话，不要重复。禁止使用括号标注动作或语气。'

  const prompts = [
    '讲个冷笑话吧',
    '来个经典笑话',
    '说个谐音梗',
    '讲个脑筋急转弯',
    '来个段子',
    '讲个动物笑话',
    '说个职场笑话',
    '来个程序员笑话',
    '讲个生活中的搞笑事'
  ]
  const userMsg = prompts[Math.floor(Math.random() * prompts.length)]

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMsg }
  ]

  await streamChat(messages, { ...config, temperature: 1.0 }, { hideDelay: 15000 })
  scheduleRandomJoke()
}

/**
 * 根据 AI 模式决定是否启动随机笑话
 * 仅解压模式且配置了 API 才启动
 */
export function startJokeIfDecompress() {
  const config = loadAiConfig()
  if (config.mode === 'decompress' && config.apiKey && config.baseUrl) {
    scheduleRandomJoke()
  } else {
    stopRandomJoke()
  }
}

/**
 * 通用流式/非流式聊天请求
 * 处理 SSE 流式响应，实时更新聊天气泡内容
 * @param {Array} messages - 消息数组
 * @param {Object} config - AI 配置
 * @param {Object} options - 选项 { hideDelay: 自动隐藏延迟 }
 */
async function streamChat(messages, config, options = {}) {
  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: config.stream
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      if (options.hideDelay === 15000) scheduleRandomJoke()
      return
    }

    const chatWin = getChatWindow()

    // 非流式模式：等待完整响应
    if (!config.stream) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      if (chatWin && !chatWin.isDestroyed() && content) {
        chatWin.webContents.send('chat-update', { text: content })
        showChat()
      }
      scheduleChatHide(options.hideDelay)
      return
    }

    // 流式模式：逐步读取并实时显示
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''
    let shown = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullText += delta
            if (chatWin && !chatWin.isDestroyed()) {
              chatWin.webContents.send('chat-update', { text: fullText })
              if (!shown) {
                showChat()
                shown = true
              }
            }
          }
        } catch {
          // 跳过格式错误的 SSE 数据
        }
      }
    }

    scheduleChatHide(options.hideDelay)
  } catch {
    // 静默失败，不影响应用正常运行
  }
}

/**
 * 处理渲染进程的 AI 对话补全请求
 * 支持流式和非流式两种模式
 * 流式模式通过 'chat-stream-chunk' 事件逐步推送内容
 */
export async function handleChatCompletion(event, messages) {
  const config = loadAiConfig()
  if (!config.apiKey || !config.baseUrl) {
    return { error: '请先在设置中配置 AI 模型的 API 地址和 API Key' }
  }

  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: config.stream
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const errText = await res.text()
      return { error: `API 请求失败 (${res.status}): ${errText}` }
    }

    // 非流式：直接返回完整内容
    if (!config.stream) {
      const data = await res.json()
      return { content: data.choices?.[0]?.message?.content || '' }
    }

    // 流式：通过事件逐块推送到渲染进程
    const sender = event.sender
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)
        if (payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content || ''
          if (delta) {
            fullContent += delta
            sender.send('chat-stream-chunk', delta)
          }
        } catch {
          // 跳过格式错误的 SSE 数据
        }
      }
    }

    sender.send('chat-stream-done')
    return { content: fullContent }
  } catch (err) {
    return { error: `请求异常: ${err.message}` }
  }
}
