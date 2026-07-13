import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  moveWindow: (dx, dy) => ipcRenderer.send('window-move', { dx, dy }),
  startDrag: (pos) => ipcRenderer.send('drag-start', pos),
  endDrag: () => ipcRenderer.send('drag-end'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  setChatMode: (mode) => ipcRenderer.send('set-chat-mode', mode),
  pauseChatHide: () => ipcRenderer.send('pause-chat-hide'),
  resumeChatHide: () => ipcRenderer.send('resume-chat-hide'),
  hideChatWindow: () => ipcRenderer.send('hide-chat-window'),
  resizeChatWindow: (h) => ipcRenderer.send('resize-chat-window', h),
  openSettings: () => ipcRenderer.send('open-settings'),
  openClipboard: () => ipcRenderer.send('open-clipboard'),
  openJsonViewer: () => ipcRenderer.send('open-json-viewer'),
  jsonViewerLoadCache: () => ipcRenderer.invoke('json-viewer-load-cache'),
  jsonViewerSaveCache: (data) => ipcRenderer.invoke('json-viewer-save-cache', data),
  onJsonViewerOpenTab: (cb) => ipcRenderer.on('json-viewer-open-tab', (_, content) => cb(content)),
  openTasks: () => ipcRenderer.send('open-tasks'),
  openReport: () => ipcRenderer.send('open-report'),
  startScreenshot: () => ipcRenderer.send('start-screenshot'),
  closeNotify: () => ipcRenderer.send('close-notify'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
  deleteClipboardItem: (index) => ipcRenderer.invoke('delete-clipboard-item', index),
  copyClipboardItem: (item) => ipcRenderer.invoke('copy-clipboard-item', item),
  openImagePreview: (dataUrl) => ipcRenderer.send('open-image-preview', dataUrl),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),
  checkShortcut: (accelerator) => ipcRenderer.invoke('check-shortcut', accelerator),
  getTasks: () => ipcRenderer.invoke('get-tasks'),
  addTask: (task) => ipcRenderer.invoke('add-task', task),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  toggleTask: (id) => ipcRenderer.invoke('toggle-task', id),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
  selectApp: () => ipcRenderer.invoke('select-app'),
  testTask: (task) => ipcRenderer.invoke('test-task', task),
  getWindowInfo: () => ipcRenderer.invoke('get-window-info'),
  onChatUpdate: (callback) => ipcRenderer.on('chat-update', (_, data) => callback(data)),
  getAiConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAiConfig: (config) => ipcRenderer.invoke('save-ai-config', config),
  chatCompletion: (messages) => ipcRenderer.invoke('chat-completion', messages),
  onChatStreamChunk: (callback) => ipcRenderer.on('chat-stream-chunk', (_, chunk) => callback(chunk)),
  onChatStreamDone: (callback) => ipcRenderer.on('chat-stream-done', () => callback()),
  offChatStream: () => {
    ipcRenderer.removeAllListeners('chat-stream-chunk')
    ipcRenderer.removeAllListeners('chat-stream-done')
  },
  screenshotCancel: () => ipcRenderer.send('screenshot-cancel'),
  screenshotShow: () => ipcRenderer.send('screenshot-show'),
  screenshotCapture: (dataUrl) => ipcRenderer.invoke('screenshot-capture', dataUrl),
  screenshotSave: (dataUrl) => ipcRenderer.invoke('screenshot-save', dataUrl),
  screenshotPin: (dataUrl, rect) => ipcRenderer.invoke('screenshot-pin', dataUrl, rect),
  onScreenshotStart: (cb) => ipcRenderer.on('screenshot-start', () => cb()),
  onScreenshotData: (cb) => ipcRenderer.on('screenshot-data', (_, data) => cb(data)),
  onScreenshotCopy: (cb) => ipcRenderer.on('screenshot-copy', () => cb()),

  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, data) => cb(data)),
  onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_, data) => cb(data)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, data) => cb(data)),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, data) => cb(data)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', () => cb()),

  getReportConfig: () => ipcRenderer.invoke('get-report-config'),
  saveReportConfig: (config) => ipcRenderer.invoke('save-report-config', config),
  selectProjectDir: () => ipcRenderer.invoke('select-project-dir'),
  generateReport: (params) => ipcRenderer.invoke('generate-report', params),
  exportReport: (report) => ipcRenderer.invoke('export-report', report)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
