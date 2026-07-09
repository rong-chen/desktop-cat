<template>
  <div class="clipboard-page">
    <div class="titlebar"></div>
    <div class="clipboard-header">
      <h2>剪贴板历史</h2>
      <div class="header-actions">
        <input
          class="search-input"
          type="text"
          placeholder="搜索..."
          v-model="search"
        />
        <button class="clear-all-btn" @click="clearAll">清空</button>
      </div>
    </div>
    <div class="clipboard-list">
      <div
        class="clipboard-item"
        v-for="(item, index) in filteredList"
        :key="item.time"
        @click="copy(item, $event)"
      >
        <div class="item-text">{{ item.text }}</div>
        <div class="item-footer">
          <span class="item-time">{{ formatTime(item.time) }}</span>
          <span class="copy-tip" v-if="item.copied">已复制</span>
          <button class="item-delete" @click.stop="deleteItem(index)">删除</button>
        </div>
      </div>
      <div class="empty" v-if="filteredList.length === 0">
        暂无记录
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const history = ref([])
const search = ref('')

const filteredList = computed(() => {
  if (!search.value) return history.value
  return history.value.filter(item =>
    item.text.toLowerCase().includes(search.value.toLowerCase())
  )
})

onMounted(async () => {
  history.value = await window.api.getClipboardHistory()
})

function formatTime(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function copy(item, e) {
  await window.api.copyClipboardItem(item.text)
  item.copied = true
  setTimeout(() => { item.copied = false }, 1500)
}

async function deleteItem(index) {
  history.value = await window.api.deleteClipboardItem(index)
}

async function clearAll() {
  await window.api.clearClipboardHistory()
  history.value = []
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
  border-bottom: 1px solid rgba(208, 183, 152, 0.3);
  z-index: 100;
  -webkit-app-region: drag;
}

.clipboard-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 52px 16px 16px;
}

.clipboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.clipboard-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.search-input {
  padding: 5px 10px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  font-size: 12px;
  width: 160px;
  outline: none;
}

.search-input:focus {
  border-color: #b08968;
}

.clear-all-btn {
  padding: 5px 12px;
  font-size: 11px;
  border: 1px solid #d0b798;
  border-radius: 6px;
  background: #fff;
  color: #5a4a3a;
  cursor: pointer;
}

.clear-all-btn:hover {
  background: #f0e6d6;
}

.clipboard-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.clipboard-item {
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e8ddd0;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.clipboard-item:hover {
  border-color: #d0b798;
}

.item-text {
  font-size: 12px;
  line-height: 1.4;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre-wrap;
  word-break: break-all;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.item-time {
  font-size: 10px;
  color: #8a7a6a;
}

.item-delete {
  font-size: 10px;
  border: none;
  background: none;
  color: #c0a080;
  cursor: pointer;
}

.item-delete:hover {
  color: #a05050;
}

.copy-tip {
  font-size: 10px;
  color: #6a8a5a;
  margin-left: auto;
  margin-right: 8px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #8a7a6a;
  font-size: 13px;
}
</style>
