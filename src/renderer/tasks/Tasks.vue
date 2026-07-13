<template>
  <div class="tasks-page">
    <div class="titlebar"></div>
    <div class="tasks-header">
      <h2>定时任务</h2>
      <button class="add-btn" @click="showForm = true">新增任务</button>
    </div>

    <div class="form-panel" v-if="showForm">
      <div class="form-row">
        <label>名称</label>
        <input v-model="form.name" placeholder="任务名称" />
      </div>
      <div class="form-row">
        <label>类型</label>
        <select v-model="form.type">
          <option value="notification">消息提醒</option>
          <option value="open-app">打开软件</option>
          <option value="run-script">执行脚本</option>
        </select>
      </div>
      <div class="form-row" v-if="form.type === 'notification'">
        <label>消息内容</label>
        <input v-model="form.message" placeholder="弹窗显示的内容" />
      </div>
      <div class="form-row" v-if="form.type === 'open-app'">
        <label>应用</label>
        <input v-model="form.appPath" placeholder="点击右侧选择应用" readonly />
        <button class="select-btn" @click="selectApp">选择</button>
      </div>
      <div class="form-row" v-if="form.type === 'run-script'">
        <label>工作目录</label>
        <input v-model="form.scriptPath" placeholder="点击右侧选择目录" readonly />
        <button class="select-btn" @click="selectScriptDir">选择</button>
      </div>
      <div class="form-row" v-if="form.type === 'run-script'">
        <label>执行命令</label>
        <textarea
          v-model="form.scriptArgs"
          placeholder="如: bash deploy.sh / python build.py / node index.js"
          rows="3"
        ></textarea>
      </div>
      <div class="form-row vars-hint" v-if="form.type === 'run-script'">
        <label></label>
        <div class="hint-text">
          可用变量：<code>${gitUser}</code> Git用户名，
          <code>${projectName_N}</code> 第N个项目名，
          <code>${projectPath_N}</code> 第N个项目路径，
          <code>${allProjectNames}</code> 所有项目名(逗号分隔)，
          <code>${allProjectPaths}</code> 所有项目路径(逗号分隔)，
          <code>${report}</code> 最近生成的报告内容
        </div>
      </div>
      <div class="form-row" v-if="form.type === 'run-script'">
        <label>Git 分析</label>
        <label class="checkbox-item">
          <input type="checkbox" v-model="form.enableGitReport" />
          <span>执行前先生成 Git 报告（执行完毕后再运行脚本）</span>
        </label>
      </div>
      <div class="form-row" v-if="form.type === 'run-script' && form.enableGitReport">
        <label>报告类型</label>
        <select v-model="form.gitReportType">
          <option value="daily">日报</option>
          <option value="weekly">周报</option>
          <option value="monthly">月报</option>
        </select>
      </div>
      <div class="form-row">
        <label>执行时间</label>
        <select v-model="form.cronPreset" @change="onPresetChange">
          <option value="">自定义 cron</option>
          <option value="every-min">每分钟</option>
          <option value="every-hour">每小时整点</option>
          <option value="daily">每天指定时间</option>
          <option value="weekly">每周指定天</option>
        </select>
      </div>
      <div class="form-row" v-if="form.cronPreset === 'daily' || form.cronPreset === 'weekly'">
        <label>时间</label>
        <input type="time" v-model="form.time" />
      </div>
      <div class="form-row" v-if="form.cronPreset === 'weekly'">
        <label>星期</label>
        <div class="weekday-checkboxes">
          <label v-for="(name, idx) in weekDays" :key="idx" class="weekday-item">
            <input type="checkbox" :value="idx" v-model="form.weekdays" />
            <span>{{ name }}</span>
          </label>
        </div>
      </div>
      <div class="form-row" v-if="!form.cronPreset">
        <label>Cron</label>
        <input v-model="form.cron" placeholder="* * * * *" />
      </div>
      <div class="form-row">
        <label>执行日</label>
        <div class="day-mode-group">
          <label class="day-mode-item">
            <input type="radio" value="all" v-model="form.dayMode" />
            <span>所有天</span>
          </label>
          <label class="day-mode-item">
            <input type="radio" value="workday" v-model="form.dayMode" />
            <span>仅工作日</span>
          </label>
          <label class="day-mode-item">
            <input type="radio" value="holiday" v-model="form.dayMode" />
            <span>仅非工作日</span>
          </label>
        </div>
      </div>
      <div class="form-actions">
        <button @click="saveTask">{{ editingId ? '保存' : '添加' }}</button>
        <button class="test-btn" @click="testTask" :disabled="testing">
          {{ testing ? '执行中...' : '测试执行' }}
        </button>
        <button class="cancel-btn" @click="cancelForm">取消</button>
      </div>
      <div class="test-result" v-if="testResult">
        <div class="test-result-header" :class="{ success: testResult.exitCode === 0, error: testResult.exitCode !== 0 }">
          {{ testResult.exitCode === 0 ? '执行成功' : '执行失败' }}
          <span class="test-meta">退出码: {{ testResult.exitCode }} | 耗时: {{ testResult.duration }}ms</span>
        </div>
        <pre class="test-output" v-if="testResult.stdout">{{ testResult.stdout }}</pre>
        <pre class="test-stderr" v-if="testResult.stderr">{{ testResult.stderr }}</pre>
      </div>
    </div>

    <table class="tasks-table" v-if="tasks.length > 0">
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>调度</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in tasks" :key="task.id">
          <td>{{ task.name }}</td>
          <td>{{ typeLabel(task.type) }}</td>
          <td class="cron-cell">
            {{ task.cron }}
            <span v-if="task.dayMode === 'workday'" class="day-mode-tag workday">工作日</span>
            <span v-if="task.dayMode === 'holiday'" class="day-mode-tag holiday">非工作日</span>
          </td>
          <td>
            <span class="status-tag" :class="{ enabled: task.enabled }">
              {{ task.enabled ? '启用' : '停用' }}
            </span>
          </td>
          <td class="actions-cell">
            <button @click="toggleTask(task)">{{ task.enabled ? '停用' : '启用' }}</button>
            <button @click="editTask(task)">编辑</button>
            <button v-if="task.type === 'run-script'" @click="viewLogs(task)">日志</button>
            <button class="delete-btn" @click="deleteTask(task.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty" v-if="tasks.length === 0 && !showForm">
      暂无任务，点击"新增任务"开始
    </div>

    <div class="log-panel" v-if="showLogs">
      <div class="log-header">
        <h3>执行日志 - {{ logTaskName }}</h3>
        <button class="cancel-btn" @click="showLogs = false">关闭</button>
      </div>
      <div class="log-list" v-if="logs.length > 0">
        <div class="log-item" v-for="(log, i) in logs" :key="i" :class="{ error: log.exitCode !== 0 }">
          <div class="log-meta">
            <span class="log-time">{{ formatTime(log.time) }}</span>
            <span class="log-exit" :class="{ success: log.exitCode === 0 }">
              退出码: {{ log.exitCode }}
            </span>
            <span class="log-duration">耗时: {{ log.duration }}ms</span>
          </div>
          <div class="log-output" v-if="log.stdout">
            <pre>{{ log.stdout }}</pre>
          </div>
          <div class="log-stderr" v-if="log.stderr">
            <pre>{{ log.stderr }}</pre>
          </div>
        </div>
      </div>
      <div class="log-empty" v-else>暂无执行日志</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'

const tasks = ref([])
const showForm = ref(false)
const editingId = ref(null)
const showLogs = ref(false)
const testing = ref(false)
const testResult = ref(null)
const logTaskName = ref('')
const logs = ref([])
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const form = reactive({
  name: '',
  type: 'notification',
  message: '',
  appPath: '',
  scriptPath: '',
  scriptArgs: '',
  enableGitReport: false,
  gitReportType: 'daily',
  cronPreset: 'daily',
  time: '09:00',
  weekdays: [],
  dayMode: 'all',
  cron: ''
})

onMounted(async () => {
  tasks.value = await window.api.getTasks()
})

function typeLabel(type) {
  if (type === 'notification') return '消息提醒'
  if (type === 'open-app') return '打开软件'
  if (type === 'run-script') return '执行脚本'
  return type
}

function onPresetChange() {
  form.cron = ''
  form.weekdays = []
}

function buildCron() {
  if (!form.cronPreset) return form.cron
  if (form.cronPreset === 'every-min') return '* * * * *'
  if (form.cronPreset === 'every-hour') return '0 * * * *'
  const [h, m] = (form.time || '9:00').split(':')
  if (form.cronPreset === 'daily') return `${parseInt(m)} ${parseInt(h)} * * *`
  if (form.cronPreset === 'weekly') {
    const days = form.weekdays.length > 0 ? [...form.weekdays].sort((a, b) => a - b).join(',') : '*'
    return `${parseInt(m)} ${parseInt(h)} * * ${days}`
  }
  return form.cron
}

async function saveTask() {
  const cron = buildCron()
  if (!form.name || !cron) return

  const data = {
    name: form.name,
    type: form.type,
    cron,
    message: form.type === 'notification' ? form.message : '',
    appPath: form.type === 'open-app' ? form.appPath : '',
    scriptPath: form.type === 'run-script' ? form.scriptPath : '',
    scriptArgs: form.type === 'run-script' ? form.scriptArgs : '',
    enableGitReport: form.type === 'run-script' ? form.enableGitReport : false,
    gitReportType: form.type === 'run-script' ? form.gitReportType : 'daily',
    weekdays: [...form.weekdays],
    dayMode: form.dayMode,
    enabled: true
  }

  try {
    if (editingId.value) {
      data.id = editingId.value
      await window.api.updateTask(data)
    } else {
      await window.api.addTask(data)
    }
    tasks.value = await window.api.getTasks()
    cancelForm()
  } catch (e) {
    console.error('保存任务失败:', e)
    alert('保存失败: ' + e.message)
  }
}

function editTask(task) {
  editingId.value = task.id
  form.name = task.name
  form.type = task.type
  form.message = task.message || ''
  form.appPath = task.appPath || ''
  form.scriptPath = task.scriptPath || ''
  form.scriptArgs = task.scriptArgs || ''
  form.enableGitReport = task.enableGitReport || false
  form.gitReportType = task.gitReportType || 'daily'
  form.weekdays = task.weekdays || []
  form.dayMode = task.dayMode || 'all'
  form.cronPreset = ''
  form.cron = task.cron
  showForm.value = true
}

async function toggleTask(task) {
  await window.api.toggleTask(task.id)
  tasks.value = await window.api.getTasks()
}

async function deleteTask(id) {
  await window.api.deleteTask(id)
  tasks.value = await window.api.getTasks()
}

async function selectApp() {
  const path = await window.api.selectApp()
  if (path) {
    form.appPath = path
  }
}

async function selectScriptDir() {
  const path = await window.api.selectScriptDir()
  if (path) {
    form.scriptPath = path
  }
}

async function testTask() {
  const data = {
    id: editingId.value || 'test',
    name: form.name || 'test',
    type: form.type,
    message: form.type === 'notification' ? (form.message || form.name) : '',
    appPath: form.type === 'open-app' ? form.appPath : '',
    scriptPath: form.type === 'run-script' ? form.scriptPath : '',
    scriptArgs: form.type === 'run-script' ? form.scriptArgs : '',
    enableGitReport: form.type === 'run-script' ? form.enableGitReport : false,
    gitReportType: form.type === 'run-script' ? form.gitReportType : 'daily'
  }
  testing.value = true
  testResult.value = null
  try {
    const result = await window.api.testTask(data)
    testResult.value = result
  } catch (e) {
    testResult.value = { exitCode: -1, stdout: '', stderr: e.message, duration: 0 }
  } finally {
    testing.value = false
  }
}

async function viewLogs(task) {
  logTaskName.value = task.name
  logs.value = await window.api.getTaskLogs(task.id)
  logs.value.reverse()
  showLogs.value = true
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString()
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
  testResult.value = null
  form.name = ''
  form.type = 'notification'
  form.message = ''
  form.appPath = ''
  form.scriptPath = ''
  form.scriptArgs = ''
  form.enableGitReport = false
  form.gitReportType = 'daily'
  form.cronPreset = 'daily'
  form.time = '09:00'
  form.weekdays = []
  form.dayMode = 'all'
  form.cron = ''
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

.tasks-page {
  padding: 52px 24px 24px;
}

.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.tasks-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.add-btn {
  padding: 6px 16px;
  font-size: 12px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #d0b798;
  color: #fff;
  cursor: pointer;
}

.add-btn:hover {
  background: #b8a080;
}

.form-panel {
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.form-row label {
  font-size: 12px;
  min-width: 70px;
  color: #5a4a3a;
}

.form-row input:not([type="checkbox"]):not([type="radio"]),
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

.form-row input:not([type="checkbox"]):not([type="radio"]):focus,
.form-row select:focus {
  border-color: #b08968;
}

.weekday-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.weekday-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  min-width: auto !important;
  cursor: pointer;
  padding: 3px 8px;
  border: 1px solid #e8ddd0;
  border-radius: 4px;
  transition: all 0.15s;
}

.weekday-item:has(input:checked) {
  background: #d0b798;
  color: #fff;
  border-color: #d0b798;
}

.weekday-item input[type="checkbox"] {
  display: none;
}

.day-mode-group {
  display: flex;
  gap: 12px;
}

.day-mode-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  min-width: auto !important;
  cursor: pointer;
}

.day-mode-item input[type="radio"] {
  width: 14px;
  height: 14px;
  flex: none;
  accent-color: #d0b798;
}

.day-mode-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.day-mode-tag.workday {
  background: #e8f0ff;
  color: #4a6fa5;
}

.day-mode-tag.holiday {
  background: #fff0e8;
  color: #a56a4a;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.form-actions button {
  padding: 6px 16px;
  font-size: 12px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #d0b798;
  color: #fff;
  cursor: pointer;
}

.form-actions button:hover {
  background: #b8a080;
}

.cancel-btn {
  background: #fff !important;
  color: #5a4a3a !important;
}

.cancel-btn:hover {
  background: #f0e6d6 !important;
}

.select-btn {
  padding: 6px 12px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
  white-space: nowrap;
}

.select-btn:hover {
  background: #f0e6d6;
}

.test-btn {
  background: #fff !important;
  color: #5a4a3a !important;
  border: 1px solid #d0b798 !important;
}

.test-btn:hover {
  background: #f0e6d6 !important;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
}

.tasks-table th {
  text-align: left;
  font-size: 11px;
  color: #8a7a6a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 12px;
  border-bottom: 1px solid #e8ddd0;
}

.tasks-table td {
  font-size: 13px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0ebe3;
}

.cron-cell {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
  color: #8a7a6a;
}

.status-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0ebe3;
  color: #8a7a6a;
}

.status-tag.enabled {
  background: #e8f5e8;
  color: #4a8a4a;
}

.actions-cell {
  display: flex;
  gap: 6px;
}

.actions-cell button {
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 4px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.actions-cell button:hover {
  background: #f0e6d6;
}

.delete-btn {
  color: #a05050 !important;
  border-color: #e0b0b0 !important;
}

.delete-btn:hover {
  background: #fde8e8 !important;
}

.empty {
  text-align: center;
  padding: 60px;
  color: #8a7a6a;
  font-size: 13px;
}

.form-row textarea {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
  color: #3a2a1a;
  outline: none;
  resize: vertical;
  font-family: 'SF Mono', Consolas, monospace;
}

.form-row textarea:focus {
  border-color: #b08968;
}

.vars-hint .hint-text {
  font-size: 11px;
  color: #8a7a6a;
  line-height: 1.6;
}

.vars-hint code {
  background: #f0ebe3;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-family: 'SF Mono', Consolas, monospace;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  cursor: pointer;
  min-width: auto !important;
}

.checkbox-item input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #d0b798;
}

.test-result {
  margin-top: 12px;
  border: 1px solid #e8ddd0;
  border-radius: 6px;
  overflow: hidden;
}

.test-result-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.test-result-header.success {
  background: #e8f5e8;
  color: #4a8a4a;
}

.test-result-header.error {
  background: #fef0f0;
  color: #a05050;
}

.test-meta {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.8;
}

.test-output,
.test-stderr {
  font-size: 11px;
  font-family: 'SF Mono', Consolas, monospace;
  padding: 8px 12px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
}

.test-output {
  background: #f8f5f0;
  color: #3a2a1a;
}

.test-stderr {
  background: #fef0f0;
  color: #a05050;
}

.log-panel {
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 10px;
  padding: 20px;
  margin-top: 20px;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.log-header h3 {
  font-size: 14px;
  font-weight: 600;
}

.log-list {
  max-height: 400px;
  overflow-y: auto;
}

.log-item {
  border: 1px solid #f0ebe3;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}

.log-item.error {
  border-color: #f0c0c0;
  background: #fffafa;
}

.log-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  margin-bottom: 6px;
}

.log-time {
  color: #5a4a3a;
}

.log-exit {
  color: #a05050;
  font-weight: 500;
}

.log-exit.success {
  color: #4a8a4a;
}

.log-duration {
  color: #8a7a6a;
}

.log-output pre,
.log-stderr pre {
  font-size: 11px;
  font-family: 'SF Mono', Consolas, monospace;
  background: #f8f5f0;
  border-radius: 4px;
  padding: 8px;
  margin: 4px 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 150px;
  overflow-y: auto;
}

.log-stderr pre {
  background: #fef0f0;
  color: #a05050;
}

.log-empty {
  text-align: center;
  padding: 30px;
  color: #8a7a6a;
  font-size: 13px;
}
</style>
