<template>
  <div class="report-page">
    <div class="titlebar"></div>

    <div class="report-section">
      <div class="section-header">
        <h2>项目配置</h2>
      </div>
      <div class="section-content">
        <div class="form-row">
          <label>Git 用户名</label>
          <input v-model="config.gitUser" placeholder="留空则不过滤作者" />
        </div>
        <div class="project-list">
          <div class="project-item" v-for="(p, i) in config.projects" :key="i">
            <span class="project-name">{{ p.name }}</span>
            <span class="project-path">{{ p.path }}</span>
            <button class="remove-btn" @click="removeProject(i)">删除</button>
          </div>
          <button class="add-btn" @click="addProject">+ 添加项目</button>
        </div>
      </div>
    </div>

    <div class="report-section">
      <div class="section-header">
        <h2>生成报告</h2>
      </div>
      <div class="section-content">
        <div class="type-row">
          <button
            v-for="t in types"
            :key="t.value"
            class="type-btn"
            :class="{ active: reportType === t.value }"
            @click="reportType = t.value"
          >
            {{ t.label }}
          </button>
        </div>
        <div v-if="reportType === 'custom'" class="date-row">
          <input type="date" v-model="customStart" />
          <span>至</span>
          <input type="date" v-model="customEnd" />
        </div>
        <button class="generate-btn" @click="generate" :disabled="generating">
          {{ generating ? '生成中...' : '生成报告' }}
        </button>
        <p v-if="error" class="error-text">{{ error }}</p>
      </div>
    </div>

    <div v-if="report" class="report-section">
      <div class="section-header">
        <h2>{{ report.title }}</h2>
        <button class="export-btn" @click="exportReport">导出 .md</button>
      </div>
      <div class="section-content report-result">
        <p class="report-period">{{ report.period }}</p>
        <h3>工作摘要</h3>
        <p>{{ report.summary }}</p>

        <div v-for="project in report.projects" :key="project.name" class="report-project">
          <h3>{{ project.name }}</h3>
          <ul>
            <li v-for="(item, i) in project.items" :key="i">
              <span class="item-tag" :class="item.type">{{ item.type }}</span>
              {{ item.description }}
            </li>
          </ul>
        </div>

        <h3>下一步计划</h3>
        <ul>
          <li v-for="(plan, i) in report.next_plan" :key="i">{{ plan }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const config = reactive({ projects: [], gitUser: '' })
const reportType = ref('daily')
const customStart = ref('')
const customEnd = ref('')
const generating = ref(false)
const error = ref('')
const report = ref(null)

const types = [
  { label: '日报', value: 'daily' },
  { label: '周报', value: 'weekly' },
  { label: '月报', value: 'monthly' },
  { label: '自定义', value: 'custom' }
]

onMounted(async () => {
  const saved = await window.api.getReportConfig()
  Object.assign(config, saved)
})

async function addProject() {
  const dir = await window.api.selectProjectDir()
  if (!dir) return
  const name = dir.split('/').pop() || dir
  config.projects.push({ name, path: dir })
  await window.api.saveReportConfig({ ...config })
}

function removeProject(index) {
  config.projects.splice(index, 1)
  window.api.saveReportConfig({ ...config })
}

async function generate() {
  if (!config.projects.length) {
    error.value = '请先添加项目'
    return
  }
  error.value = ''
  generating.value = true
  report.value = null

  try {
    const result = await window.api.generateReport({
      type: reportType.value,
      projects: config.projects,
      gitUser: config.gitUser,
      customRange: reportType.value === 'custom' ? { start: customStart.value, end: customEnd.value } : null
    })
    report.value = result
  } catch (e) {
    error.value = e.message || '生成失败'
  } finally {
    generating.value = false
  }
}

async function exportReport() {
  if (!report.value) return
  await window.api.exportReport(report.value)
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

.report-page {
  padding: 52px 24px 24px;
  overflow-y: auto;
  height: 100vh;
}

.report-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.section-content {
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 10px;
  padding: 16px 20px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row label {
  font-size: 13px;
  min-width: 80px;
  color: #5a4a3a;
}

.form-row input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
  color: #3a2a1a;
  outline: none;
}

.form-row input:focus {
  border-color: #b08968;
}

.project-list {
  margin-top: 8px;
}

.project-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0ebe3;
  gap: 12px;
}

.project-item:last-child {
  border-bottom: none;
}

.project-name {
  font-size: 13px;
  font-weight: 500;
  min-width: 100px;
}

.project-path {
  flex: 1;
  font-size: 11px;
  color: #8a7a6a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  padding: 3px 8px;
  font-size: 11px;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  background: #fff;
  color: #e74c3c;
  cursor: pointer;
}

.remove-btn:hover {
  background: #fdf0ef;
}

.add-btn {
  margin-top: 8px;
  padding: 6px 14px;
  font-size: 12px;
  border: 1px dashed #d0b798;
  border-radius: 6px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.add-btn:hover {
  background: #f5ede3;
}

.type-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.type-btn {
  padding: 6px 16px;
  font-size: 12px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.type-btn.active {
  background: #d0b798;
  color: #fff;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.date-row input {
  padding: 6px 10px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
}

.date-row span {
  font-size: 12px;
  color: #7a6a5a;
}

.generate-btn {
  padding: 8px 24px;
  font-size: 13px;
  background: #d0b798;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.generate-btn:hover {
  background: #b8a080;
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  margin-top: 8px;
  font-size: 12px;
  color: #e74c3c;
}

.export-btn {
  padding: 5px 12px;
  font-size: 12px;
  border: 1px solid #d0b798;
  border-radius: 4px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.export-btn:hover {
  background: #f5ede3;
}

.report-result h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 14px 0 6px;
}

.report-period {
  font-size: 12px;
  color: #7a6a5a;
  margin-bottom: 8px;
}

.report-project {
  margin-bottom: 12px;
}

.report-result ul {
  padding-left: 20px;
}

.report-result li {
  font-size: 13px;
  line-height: 1.8;
}

.item-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  margin-right: 4px;
  font-weight: 500;
}

.item-tag.feature { background: #e8f5e9; color: #2e7d32; }
.item-tag.fix { background: #fce4ec; color: #c62828; }
.item-tag.refactor { background: #e3f2fd; color: #1565c0; }
.item-tag.docs { background: #fff3e0; color: #e65100; }
.item-tag.other { background: #f3e5f5; color: #6a1b9a; }
</style>
