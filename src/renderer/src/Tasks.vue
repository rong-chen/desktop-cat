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
        <select v-model="form.weekday">
          <option v-for="(name, idx) in weekDays" :key="idx" :value="idx">{{ name }}</option>
        </select>
      </div>
      <div class="form-row" v-if="!form.cronPreset">
        <label>Cron</label>
        <input v-model="form.cron" placeholder="* * * * *" />
      </div>
      <div class="form-actions">
        <button @click="saveTask">{{ editingId ? '保存' : '添加' }}</button>
        <button class="test-btn" @click="testTask">测试执行</button>
        <button class="cancel-btn" @click="cancelForm">取消</button>
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
          <td>{{ task.type === 'notification' ? '消息提醒' : '打开软件' }}</td>
          <td class="cron-cell">{{ task.cron }}</td>
          <td>
            <span class="status-tag" :class="{ enabled: task.enabled }">
              {{ task.enabled ? '启用' : '停用' }}
            </span>
          </td>
          <td class="actions-cell">
            <button @click="toggleTask(task)">{{ task.enabled ? '停用' : '启用' }}</button>
            <button @click="editTask(task)">编辑</button>
            <button class="delete-btn" @click="deleteTask(task.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="empty" v-if="tasks.length === 0 && !showForm">
      暂无任务，点击"新增任务"开始
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'

const tasks = ref([])
const showForm = ref(false)
const editingId = ref(null)
const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const form = reactive({
  name: '',
  type: 'notification',
  message: '',
  appPath: '',
  cronPreset: 'daily',
  time: '09:00',
  weekday: 1,
  cron: ''
})

onMounted(async () => {
  tasks.value = await window.api.getTasks()
})

function onPresetChange() {
  form.cron = ''
}

function buildCron() {
  if (!form.cronPreset) return form.cron
  if (form.cronPreset === 'every-min') return '* * * * *'
  if (form.cronPreset === 'every-hour') return '0 * * * *'
  const [h, m] = (form.time || '9:00').split(':')
  if (form.cronPreset === 'daily') return `${parseInt(m)} ${parseInt(h)} * * *`
  if (form.cronPreset === 'weekly') return `${parseInt(m)} ${parseInt(h)} * * ${form.weekday}`
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
    enabled: true
  }

  if (editingId.value) {
    data.id = editingId.value
    await window.api.updateTask(data)
  } else {
    await window.api.addTask(data)
  }

  tasks.value = await window.api.getTasks()
  cancelForm()
}

function editTask(task) {
  editingId.value = task.id
  form.name = task.name
  form.type = task.type
  form.message = task.message || ''
  form.appPath = task.appPath || ''
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

async function testTask() {
  const data = {
    type: form.type,
    message: form.type === 'notification' ? (form.message || form.name) : '',
    appPath: form.type === 'open-app' ? form.appPath : ''
  }
  await window.api.testTask(data)
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
  form.name = ''
  form.type = 'notification'
  form.message = ''
  form.appPath = ''
  form.cronPreset = 'daily'
  form.time = '09:00'
  form.weekday = 1
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
</style>
