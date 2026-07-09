import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  moveWindow: (dx, dy) => ipcRenderer.send('window-move', { dx, dy }),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  setChatMode: (mode) => ipcRenderer.send('set-chat-mode', mode),
  openSettings: () => ipcRenderer.send('open-settings'),
  openClipboard: () => ipcRenderer.send('open-clipboard'),
  openJsonViewer: () => ipcRenderer.send('open-json-viewer'),
  openTasks: () => ipcRenderer.send('open-tasks'),
  closeNotify: () => ipcRenderer.send('close-notify'),
  getClipboardHistory: () => ipcRenderer.invoke('get-clipboard-history'),
  clearClipboardHistory: () => ipcRenderer.invoke('clear-clipboard-history'),
  deleteClipboardItem: (index) => ipcRenderer.invoke('delete-clipboard-item', index),
  copyClipboardItem: (text) => ipcRenderer.invoke('copy-clipboard-item', text),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  saveShortcuts: (shortcuts) => ipcRenderer.invoke('save-shortcuts', shortcuts),
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
  }
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
