import {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  clipboard,
  globalShortcut,
  shell,
  dialog,
  Tray,
  Menu,
  nativeImage,
  net
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import cron from 'node-cron'
import { computePosition, flip, shift, offset } from '@floating-ui/core'

let mainWindow
let chatWindow
let settingsWindow
let clipboardWindow
let jsonViewerWindow
let tasksWindow
let notifyWindow
let tray = null
let clipboardHistory = []
let clipboardTimer = null
let chatHideTimer = null
let chatMenuTimer = null
let jokeTimer = null
let scheduledJobs = {}
let holidayCache = {}

const dataDir = join(app.getPath('userData'), 'data')
const clipboardFile = join(dataDir, 'clipboard.json')
const shortcutsFile = join(dataDir, 'shortcuts.json')
const tasksFile = join(dataDir, 'tasks.json')
const aiConfigFile = join(dataDir, 'ai-config.json')

const isMac = process.platform === 'darwin'
const appIcon = join(__dirname, '../../resources/icon.png')

function subWindowOptions() {
  if (isMac) {
    return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 12 } }
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fffaf3',
      symbolColor: '#5a4a3a',
      height: 44
    },
    autoHideMenuBar: true
  }
}

const defaultShortcuts = {
  toggleCat: 'CommandOrControl+Shift+C',
  openSettings: 'CommandOrControl+Shift+,',
  openClipboard: 'CommandOrControl+Shift+V'
}

function loadData() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (existsSync(clipboardFile)) {
    try {
      clipboardHistory = JSON.parse(readFileSync(clipboardFile, 'utf-8'))
    } catch (e) {
      clipboardHistory = []
    }
  }
}

function saveClipboard() {
  writeFileSync(clipboardFile, JSON.stringify(clipboardHistory, null, 2))
}

function loadShortcuts() {
  if (existsSync(shortcutsFile)) {
    try {
      return JSON.parse(readFileSync(shortcutsFile, 'utf-8'))
    } catch (e) {
      return { ...defaultShortcuts }
    }
  }
  return { ...defaultShortcuts }
}

function saveShortcuts(shortcuts) {
  writeFileSync(shortcutsFile, JSON.stringify(shortcuts, null, 2))
}

function loadTasks() {
  if (existsSync(tasksFile)) {
    try {
      return JSON.parse(readFileSync(tasksFile, 'utf-8'))
    } catch (e) {
      return []
    }
  }
  return []
}

function saveTasks(tasks) {
  writeFileSync(tasksFile, JSON.stringify(tasks, null, 2))
}

const defaultAiConfig = {
  mode: 'off',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
  stream: true,
  temperature: 0.7,
  maxTokens: 2048
}

function loadAiConfig() {
  if (existsSync(aiConfigFile)) {
    try {
      return { ...defaultAiConfig, ...JSON.parse(readFileSync(aiConfigFile, 'utf-8')) }
    } catch (e) {
      return { ...defaultAiConfig }
    }
  }
  return { ...defaultAiConfig }
}

function saveAiConfig(config) {
  writeFileSync(aiConfigFile, JSON.stringify(config, null, 2))
}

function scheduleTask(task) {
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

function checkIsWorkday() {
  const today = new Date()
  const year = today.getFullYear()
  const dateStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  if (holidayCache[dateStr] !== undefined) {
    return Promise.resolve(holidayCache[dateStr])
  }

  return new Promise((resolve) => {
    const url = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`
    const request = net.request(url)
    let body = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => {
        try {
          const data = JSON.parse(body)
          const dayInfo = data.days.find(d => d.date === dateStr)
          let isWork
          if (dayInfo) {
            isWork = !dayInfo.isOffDay
          } else {
            const dayOfWeek = today.getDay()
            isWork = dayOfWeek !== 0 && dayOfWeek !== 6
          }
          data.days.forEach(d => {
            holidayCache[d.date] = !d.isOffDay
          })
          const cachedDates = new Set(data.days.map(d => d.date))
          if (!cachedDates.has(dateStr)) {
            holidayCache[dateStr] = isWork
          }
          resolve(isWork)
        } catch {
          const dayOfWeek = today.getDay()
          resolve(dayOfWeek !== 0 && dayOfWeek !== 6)
        }
      })
    })

    request.on('error', () => {
      const dayOfWeek = today.getDay()
      resolve(dayOfWeek !== 0 && dayOfWeek !== 6)
    })

    request.end()
  })
}

function executeTask(task) {
  if (task.type === 'notification') {
    showNotifyWindow(task.message || task.name)
  } else if (task.type === 'open-app') {
    if (task.appPath) {
      shell.openPath(task.appPath)
    }
  }
}

function showNotifyWindow(message) {
  if (notifyWindow && !notifyWindow.isDestroyed()) {
    notifyWindow.close()
  }

  const { width, height } = screen.getPrimaryDisplay().size

  notifyWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    icon: appIcon,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    fullscreen: isMac,
    fullscreenable: isMac,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  const encodedMsg = encodeURIComponent(message)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    notifyWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + `/notify.html?msg=${encodedMsg}`)
  } else {
    notifyWindow.loadFile(join(__dirname, '../renderer/notify.html'), {
      query: { msg: message }
    })
  }

  notifyWindow.on('closed', () => {
    notifyWindow = null
  })
}

function scheduleAllTasks() {
  Object.values(scheduledJobs).forEach((job) => job.stop())
  scheduledJobs = {}
  const tasks = loadTasks()
  tasks.forEach(task => scheduleTask(task))
}

function startClipboardWatch() {
  let lastText = clipboard.readText()

  clipboardTimer = setInterval(() => {
    const text = clipboard.readText()
    if (text && text !== lastText) {
      lastText = text
      clipboardHistory.unshift({ text, time: Date.now() })
      if (clipboardHistory.length > 200) {
        clipboardHistory = clipboardHistory.slice(0, 200)
      }
      saveClipboard()
    }
  }, 500)
}

function registerShortcuts() {
  globalShortcut.unregisterAll()
  const shortcuts = loadShortcuts()

  if (shortcuts.toggleCat) {
    globalShortcut.register(shortcuts.toggleCat, () => {
      if (mainWindow.isVisible()) mainWindow.hide()
      else mainWindow.show()
    })
  }

  if (shortcuts.openSettings) {
    globalShortcut.register(shortcuts.openSettings, () => {
      openSettingsWindow()
    })
  }

  if (shortcuts.openClipboard) {
    globalShortcut.register(shortcuts.openClipboard, () => {
      openClipboardWindow()
    })
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 130,
    height: 130,
    x: width - 140,
    y: height - 140,
    icon: appIcon,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const CHAT_W = 200
const CHAT_H = 180
const CHAT_OFFSET = 4

function getChatPosition() {
  const [mx, my] = mainWindow.getPosition()
  const [mw, mh] = mainWindow.getSize()
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize

  const refRect = { x: mx, y: my, width: mw, height: mh }
  const floatingSize = { width: CHAT_W, height: CHAT_H }

  return computePosition(refRect, floatingSize, {
    placement: 'top',
    middleware: [offset(CHAT_OFFSET), flip(), shift({ padding: 4 })],
    platform: {
      getElementRects: () => ({
        reference: refRect,
        floating: { x: 0, y: 0, ...floatingSize }
      }),
      getDimensions: (el) => ({ width: el.width, height: el.height }),
      getClippingRect: () => ({ x: 0, y: 0, width: sw, height: sh })
    }
  }).then(({ x, y, placement }) => ({ x: Math.round(x), y: Math.round(y), placement }))
}

async function showChat() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  const pos = await getChatPosition()
  chatWindow.setPosition(pos.x, pos.y)
  chatWindow.webContents.send('chat-update', { placement: pos.placement, visible: true })
}

function hideChat() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  chatWindow.webContents.send('chat-update', { visible: false })
}

async function syncChatPosition() {
  if (!chatWindow || chatWindow.isDestroyed()) return
  const pos = await getChatPosition()
  chatWindow.setPosition(pos.x, pos.y)
  chatWindow.webContents.send('chat-update', { placement: pos.placement })
}

async function createChatWindow() {
  const pos = await getChatPosition()

  chatWindow = new BrowserWindow({
    width: CHAT_W,
    height: CHAT_H,
    x: pos.x,
    y: pos.y,
    icon: appIcon,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  chatWindow.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    chatWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/chat.html')
  } else {
    chatWindow.loadFile(join(__dirname, '../renderer/chat.html'))
  }

  chatWindow.webContents.on('did-finish-load', () => {
    chatWindow.webContents.send('chat-update', { placement: pos.placement })
    chatWindow.showInactive()
    sendChatGreeting()
  })

  chatWindow.on('closed', () => {
    chatWindow = null
  })
}

async function sendChatGreeting() {
  const config = loadAiConfig()
  if (config.mode === 'off' || !config.apiKey || !config.baseUrl) {
    return
  }

  const systemPrompt =
    config.mode === 'decompress'
      ? '你是一只可爱的桌面猫咪，负责帮用户解压放松。用温暖、轻松、活泼的语气说一句话，可以是鼓励或讲一个小笑话。控制在30字以内。禁止使用括号标注动作或语气，如(撒娇)(害羞)等，直接说话即可。'
      : '你是一只话唠桌面猫咪，喜欢跟主人聊天。用活泼、俏皮的语气随便说点什么，可以分享冷知识、吐槽天气。控制在40字以内。禁止使用括号标注动作或语气，如(撒娇)(害羞)等，直接说话即可。'

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '跟我打个招呼吧' }
  ]

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

    if (!res.ok) return

    if (chatWindow && !chatWindow.isDestroyed()) {
      showChat()
    }

    if (!config.stream) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('chat-update', { mode: 'chat', text: content })
      }
      scheduleChatHide()
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-update', { mode: 'chat', text: '' })
    }

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
            if (chatWindow && !chatWindow.isDestroyed()) {
              chatWindow.webContents.send('chat-update', { text: fullText })
            }
          }
        } catch {
          // skip
        }
      }
    }

    scheduleChatHide()
  } catch {
    // silent fail
  }
}

function scheduleChatHide(delay) {
  if (chatHideTimer) clearTimeout(chatHideTimer)
  chatHideTimer = setTimeout(() => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-update', { visible: false })
      setTimeout(() => {
        if (chatWindow && !chatWindow.isDestroyed()) {
          chatWindow.webContents.send('chat-update', { text: '', mode: 'menu' })
        }
      }, 200)
    }
  }, delay || 5000)
}

function scheduleRandomJoke() {
  if (jokeTimer) clearTimeout(jokeTimer)
  const min = 5 * 60 * 1000
  const max = 60 * 60 * 1000
  const delay = Math.floor(Math.random() * (max - min)) + min
  jokeTimer = setTimeout(() => {
    sendRandomJoke()
  }, delay)
}

function stopRandomJoke() {
  if (jokeTimer) {
    clearTimeout(jokeTimer)
    jokeTimer = null
  }
}

async function sendRandomJoke() {
  const config = loadAiConfig()
  if (config.mode !== 'decompress' || !config.apiKey || !config.baseUrl) {
    return
  }

  const systemPrompt = '你是一只会讲笑话的桌面猫咪。请讲一个笑话，可以是冷笑话、经典笑话、谐音梗、脑筋急转弯、段子等任何类型。要求有趣、有梗，控制在100字以内。每次讲不同类型不同内容的笑话，不要重复。禁止使用括号标注动作或语气。'

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

  const url = config.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model: config.model,
    messages,
    temperature: 1.0,
    max_tokens: config.maxTokens,
    stream: config.stream
  }

  try {
    if (chatWindow && !chatWindow.isDestroyed()) {
      showChat()
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
      scheduleRandomJoke()
      return
    }

    if (!config.stream) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || ''
      if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('chat-update', { mode: 'chat', text: content })
      }
      scheduleChatHide(15000)
      scheduleRandomJoke()
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('chat-update', { mode: 'chat', text: '' })
    }

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
            if (chatWindow && !chatWindow.isDestroyed()) {
              chatWindow.webContents.send('chat-update', { text: fullText })
            }
          }
        } catch {
          // skip
        }
      }
    }

    scheduleChatHide(15000)
  } catch {
    // silent fail
  }

  scheduleRandomJoke()
}

function startJokeIfDecompress() {
  const config = loadAiConfig()
  if (config.mode === 'decompress' && config.apiKey && config.baseUrl) {
    scheduleRandomJoke()
  } else {
    stopRandomJoke()
  }
}



function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 640,
    title: '设置 - Desktop Cat',
    icon: appIcon,
    resizable: false,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/settings.html')
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings.html'))
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function openClipboardWindow() {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) {
    clipboardWindow.focus()
    return
  }

  clipboardWindow = new BrowserWindow({
    width: 500,
    height: 600,
    title: '剪贴板历史 - Desktop Cat',
    icon: appIcon,
    alwaysOnTop: true,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    clipboardWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/clipboard.html')
  } else {
    clipboardWindow.loadFile(join(__dirname, '../renderer/clipboard.html'))
  }

  clipboardWindow.on('closed', () => {
    clipboardWindow = null
  })
}

function openJsonViewerWindow() {
  if (jsonViewerWindow && !jsonViewerWindow.isDestroyed()) {
    jsonViewerWindow.focus()
    return
  }

  jsonViewerWindow = new BrowserWindow({
    width: 1350,
    height: 1050,
    title: 'JSON 查看器 - Desktop Cat',
    icon: appIcon,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    jsonViewerWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/json-viewer.html')
  } else {
    jsonViewerWindow.loadFile(join(__dirname, '../renderer/json-viewer.html'))
  }

  jsonViewerWindow.on('closed', () => {
    jsonViewerWindow = null
  })
}

function openTasksWindow() {
  if (tasksWindow && !tasksWindow.isDestroyed()) {
    tasksWindow.focus()
    return
  }

  tasksWindow = new BrowserWindow({
    width: 700,
    height: 550,
    title: '定时任务 - Desktop Cat',
    icon: appIcon,
    backgroundColor: '#fffaf3',
    ...subWindowOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    tasksWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/tasks.html')
  } else {
    tasksWindow.loadFile(join(__dirname, '../renderer/tasks.html'))
  }

  tasksWindow.on('closed', () => {
    tasksWindow = null
  })
}

function createTray() {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const iconSize = isMac ? 18 : 16
  const icon = nativeImage.createFromPath(iconPath).resize({ width: iconSize, height: iconSize })
  tray = new Tray(icon)
  tray.setToolTip('Desktop Cat')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏猫咪',
      click: () => {
        if (mainWindow.isVisible()) mainWindow.hide()
        else mainWindow.show()
      }
    },
    { type: 'separator' },
    { label: '设置', click: () => openSettingsWindow() },
    { label: '剪贴板历史', click: () => openClipboardWindow() },
    { label: 'JSON 查看器', click: () => openJsonViewerWindow() },
    { label: '定时任务', click: () => openTasksWindow() },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  if (!isMac) {
    tray.on('click', () => {
      tray.popUpContextMenu(contextMenu)
    })
  }
}

function setupIpc() {
  ipcMain.on('set-ignore-mouse', (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })

  let isDragging = false
  let dragStartMouse = null
  let dragStartWin = null
  let dragPollTimer = null

  ipcMain.on('drag-start', (_, { x, y }) => {
    isDragging = true
    const [wx, wy] = mainWindow.getPosition()
    dragStartMouse = { x, y }
    dragStartWin = { x: wx, y: wy }
    hideChat()

    if (dragPollTimer) clearInterval(dragPollTimer)
    dragPollTimer = setInterval(() => {
      if (!isDragging) return
      const cursor = screen.getCursorScreenPoint()
      const dx = cursor.x - dragStartMouse.x
      const dy = cursor.y - dragStartMouse.y
      mainWindow.setPosition(dragStartWin.x + dx, dragStartWin.y + dy)
    }, 16)
  })

  ipcMain.on('drag-end', () => {
    isDragging = false
    if (dragPollTimer) {
      clearInterval(dragPollTimer)
      dragPollTimer = null
    }
    if (chatWindow && !chatWindow.isDestroyed()) {
      showChat()
      chatWindow.webContents.send('chat-update', { mode: 'menu' })
    }
  })

  ipcMain.on('window-move', (_, { dx, dy }) => {
    const [x, y] = mainWindow.getPosition()
    mainWindow.setPosition(x + dx, y + dy)
    syncChatPosition()
  })

  ipcMain.on('set-chat-mode', (_, mode) => {
    if (!chatWindow || chatWindow.isDestroyed()) return
    if (isDragging) return
    if (mode === 'menu') {
      if (chatMenuTimer) { clearTimeout(chatMenuTimer); chatMenuTimer = null }
      if (chatHideTimer) { clearTimeout(chatHideTimer); chatHideTimer = null }
      showChat()
      chatWindow.webContents.send('chat-update', { mode: 'menu' })
    } else {
      if (chatMenuTimer) clearTimeout(chatMenuTimer)
      chatMenuTimer = setTimeout(() => {
        if (!chatWindow || chatWindow.isDestroyed()) return
        chatWindow.webContents.send('chat-update', { mode: 'chat' })
        scheduleChatHide()
      }, 500)
    }
  })

  ipcMain.handle('get-window-info', () => {
    const [x, y] = mainWindow.getPosition()
    const [w, h] = mainWindow.getSize()
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    return { x, y, w, h, screenWidth: width, screenHeight: height }
  })

  ipcMain.on('open-settings', () => {
    openSettingsWindow()
  })

  ipcMain.on('open-clipboard', () => {
    openClipboardWindow()
  })

  ipcMain.on('open-json-viewer', () => {
    openJsonViewerWindow()
  })

  ipcMain.on('open-tasks', () => {
    openTasksWindow()
  })

  ipcMain.on('close-notify', () => {
    if (notifyWindow && !notifyWindow.isDestroyed()) {
      notifyWindow.close()
    }
  })

  ipcMain.handle('get-clipboard-history', () => clipboardHistory)

  ipcMain.handle('clear-clipboard-history', () => {
    clipboardHistory = []
    saveClipboard()
    return true
  })

  ipcMain.handle('delete-clipboard-item', (_, index) => {
    clipboardHistory.splice(index, 1)
    saveClipboard()
    return clipboardHistory
  })

  ipcMain.handle('copy-clipboard-item', (_, text) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('get-shortcuts', () => loadShortcuts())

  ipcMain.handle('save-shortcuts', (_, shortcuts) => {
    saveShortcuts(shortcuts)
    registerShortcuts()
    return true
  })

  ipcMain.handle('get-tasks', () => loadTasks())

  ipcMain.handle('add-task', (_, task) => {
    const tasks = loadTasks()
    task.id = Date.now().toString()
    tasks.push(task)
    saveTasks(tasks)
    scheduleTask(task)
    return tasks
  })

  ipcMain.handle('update-task', (_, task) => {
    const tasks = loadTasks()
    const idx = tasks.findIndex(t => t.id === task.id)
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...task }
      saveTasks(tasks)
      scheduleTask(tasks[idx])
    }
    return tasks
  })

  ipcMain.handle('toggle-task', (_, id) => {
    const tasks = loadTasks()
    const task = tasks.find(t => t.id === id)
    if (task) {
      task.enabled = !task.enabled
      saveTasks(tasks)
      scheduleTask(task)
    }
    return tasks
  })

  ipcMain.handle('delete-task', (_, id) => {
    let tasks = loadTasks()
    tasks = tasks.filter(t => t.id !== id)
    saveTasks(tasks)
    if (scheduledJobs[id]) {
      scheduledJobs[id].stop()
      delete scheduledJobs[id]
    }
    return tasks
  })

  ipcMain.handle('select-app', async () => {
    const isMac = process.platform === 'darwin'
    const isWin = process.platform === 'win32'
    const result = await dialog.showOpenDialog({
      title: '选择应用',
      defaultPath: isMac ? '/Applications' : isWin ? 'C:\\Program Files' : '/usr/bin',
      properties: isMac ? ['openFile', 'treatPackageAsDirectory'] : ['openFile'],
      filters: isMac
        ? [{ name: '应用程序', extensions: ['app'] }]
        : isWin
          ? [{ name: '可执行文件', extensions: ['exe', 'lnk', 'bat', 'cmd'] }]
          : [{ name: '所有文件', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('test-task', (_, task) => {
    executeTask(task)
    return true
  })

  ipcMain.handle('get-ai-config', () => loadAiConfig())

  ipcMain.handle('save-ai-config', (_, config) => {
    saveAiConfig(config)
    startJokeIfDecompress()
    return true
  })

  ipcMain.handle('chat-completion', async (event, messages) => {
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

      if (!config.stream) {
        const data = await res.json()
        return { content: data.choices?.[0]?.message?.content || '' }
      }

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
          } catch (_e) {
            // skip malformed JSON
          }
        }
      }

      sender.send('chat-stream-done')
      return { content: fullContent }
    } catch (err) {
      return { error: `请求异常: ${err.message}` }
    }
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.desktop-cat')

  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  loadData()
  setupIpc()
  createWindow()
  await createChatWindow()
  createTray()
  startClipboardWatch()
  registerShortcuts()
  scheduleAllTasks()
  startJokeIfDecompress()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 托盘模式下不退出，通过托盘菜单的"退出"来关闭
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (clipboardTimer) clearInterval(clipboardTimer)
  Object.values(scheduledJobs).forEach((job) => job.stop())
})
