<template>
  <div class="settings-page">
    <div class="titlebar"></div>
    <div class="settings-section">
      <div class="settings-header">
        <h2>快捷键设置</h2>
      </div>
      <div class="settings-content">
        <div class="shortcut-item" v-for="(item, key) in shortcuts" :key="key">
          <label>{{ item.label }}</label>
          <div
            class="shortcut-input"
            :class="{ recording: recording === key }"
            @click="startRecording(key)"
          >
            {{ recording === key ? '按下快捷键...' : item.value || '未设置' }}
          </div>
          <button class="clear-btn" @click="clearShortcut(key)">清除</button>
        </div>
      </div>
      <div class="settings-footer">
        <button class="save-btn" @click="saveShortcuts">保存快捷键</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-header">
        <h2>AI 模型配置</h2>
      </div>
      <div class="settings-content">
        <div class="form-row">
          <label>互动模式</label>
          <select v-model="ai.mode">
            <option value="off">不开启</option>
            <option value="decompress">解压模式</option>
          </select>
        </div>
        <div class="form-row">
          <label>API 地址</label>
          <input v-model="ai.baseUrl" placeholder="https://api.deepseek.com" />
        </div>
        <div class="form-row">
          <label>API Key</label>
          <div class="key-input-wrap">
            <input
              v-model="ai.apiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-..."
            />
            <button class="toggle-key-btn" @click="showKey = !showKey">
              {{ showKey ? '隐藏' : '显示' }}
            </button>
          </div>
        </div>
        <div class="form-row">
          <label>模型名称</label>
          <input v-model="ai.model" placeholder="deepseek-v4-flash" />
        </div>
        <div class="form-row">
          <label>Temperature</label>
          <input v-model.number="ai.temperature" type="number" min="0" max="2" step="0.1" />
        </div>
        <div class="form-row">
          <label>最大 Tokens</label>
          <input v-model.number="ai.maxTokens" type="number" min="1" step="256" />
        </div>
        <div class="form-row">
          <label>流式输出</label>
          <div class="toggle-wrap" @click="ai.stream = !ai.stream">
            <div class="toggle-track" :class="{ on: ai.stream }">
              <div class="toggle-thumb" />
            </div>
            <span class="toggle-label">{{ ai.stream ? '开启' : '关闭' }}</span>
          </div>
        </div>
      </div>
      <div class="settings-footer">
        <button class="save-btn" @click="saveAi">保存 AI 配置</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'

const shortcuts = ref({
  toggleCat: { label: '显示/隐藏猫咪', value: '' },
  openSettings: { label: '打开设置', value: '' },
  openClipboard: { label: '打开剪贴板', value: '' }
})

const recording = ref(null)

const ai = reactive({
  mode: 'off',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
  stream: true,
  temperature: 0.7,
  maxTokens: 2048
})

const showKey = ref(false)

onMounted(async () => {
  const saved = await window.api.getShortcuts()
  for (const key in saved) {
    if (shortcuts.value[key]) {
      shortcuts.value[key].value = saved[key]
    }
  }

  const aiConfig = await window.api.getAiConfig()
  Object.assign(ai, aiConfig)

  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
})

function startRecording(key) {
  recording.value = key
}

function onKeyDown(e) {
  if (!recording.value) return
  e.preventDefault()

  const parts = []
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  const key = e.key
  if (!['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key)
    shortcuts.value[recording.value].value = parts.join('+')
    recording.value = null
  }
}

function clearShortcut(key) {
  shortcuts.value[key].value = ''
}

async function saveShortcuts() {
  const data = {}
  for (const key in shortcuts.value) {
    data[key] = shortcuts.value[key].value
  }
  await window.api.saveShortcuts(data)
}

async function saveAi() {
  await window.api.saveAiConfig({ ...ai })
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #fffaf3;
  color: #3a2a1a;
}

.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 44px;
  background: rgba(255, 250, 243, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: 100;
  -webkit-app-region: drag;
}

.titlebar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: rgba(208, 183, 152, 0.3);
}

.settings-page {
  padding: 52px 24px 24px;
  overflow-y: auto;
  height: 100vh;
}

.settings-section {
  margin-bottom: 32px;
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.settings-content {
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 10px;
  padding: 16px 20px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e8ddd0;
  gap: 12px;
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-item label {
  font-size: 13px;
  min-width: 140px;
}

.shortcut-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  text-align: center;
  transition: border-color 0.2s;
}

.shortcut-input.recording {
  border-color: #b08968;
  background: #f5ede3;
}

.clear-btn {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 4px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.clear-btn:hover {
  background: #f0e6d6;
}

.form-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0ebe3;
  gap: 12px;
}

.form-row:last-child {
  border-bottom: none;
}

.form-row label {
  font-size: 13px;
  min-width: 100px;
  color: #5a4a3a;
}

.form-row input,
.form-row select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
  color: #3a2a1a;
  outline: none;
}

.form-row input:focus,
.form-row select:focus {
  border-color: #b08968;
}

.key-input-wrap {
  flex: 1;
  display: flex;
  gap: 8px;
}

.key-input-wrap input {
  flex: 1;
}

.toggle-key-btn {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 4px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
  white-space: nowrap;
}

.toggle-key-btn:hover {
  background: #f0e6d6;
}

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: #ccc;
  position: relative;
  transition: background 0.2s;
}

.toggle-track.on {
  background: #b08968;
}

.toggle-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-track.on .toggle-thumb {
  left: 20px;
}

.toggle-label {
  font-size: 12px;
  color: #5a4a3a;
}

.settings-footer {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  padding: 8px 20px;
  font-size: 13px;
  background: #d0b798;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.save-btn:hover {
  background: #b8a080;
}
</style>
