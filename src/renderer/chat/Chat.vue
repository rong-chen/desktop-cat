<template>
  <div class="chat-wrap" :class="['place-' + placement]">
    <div ref="bubbleRef" class="bubble" @mouseenter="onEnter" @mouseleave="onLeave">
      <div v-if="text" class="bubble-text">{{ text }}</div>
      <div class="menu-row" :class="{ 'has-text': !!text }">
        <div class="menu-item" @click="openScreenshot">
          <Icon icon="mdi:crop" :width="20" />
        </div>
        <div class="menu-item" @click="openJsonViewer">
          <Icon icon="mdi:code-json" :width="20" />
        </div>
        <div class="menu-item" @click="openClipboard">
          <Icon icon="mdi:clipboard-text" :width="20" />
        </div>
        <div class="menu-item" @click="openTasks">
          <Icon icon="mdi:calendar-clock" :width="20" />
        </div>
        <div class="menu-item" @click="openSettings">
          <Icon icon="mdi:cog" :width="20" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'

addCollection(mdiIcons)

const text = ref('')
const placement = ref('top')
const bubbleRef = ref(null)
let hovered = false
let leaveTimer = null

onMounted(() => {
  window.api.onChatUpdate((data) => {
    if (data.text !== undefined) text.value = data.text
    if (data.placement) placement.value = data.placement
  })

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const h = Math.ceil(entry.borderBoxSize[0].blockSize)
      window.api.resizeChatWindow(h)
    }
  })
  observer.observe(bubbleRef.value)
})

function onEnter() {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
  if (hovered) return
  hovered = true
  window.api.setIgnoreMouse(false)
  window.api.setChatMode('menu')
  window.api.pauseChatHide()
}

function onLeave() {
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    leaveTimer = null
    hovered = false
    window.api.setIgnoreMouse(true)
    window.api.resumeChatHide()
  }, 50)
}

function openSettings() {
  window.api.openSettings()
}

function openClipboard() {
  window.api.openClipboard()
}

function openJsonViewer() {
  window.api.openJsonViewer()
}

function openTasks() {
  window.api.openTasks()
}

function openScreenshot() {
  window.api.startScreenshot()
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
}

html,
body,
#app {
  width: 100%;
  height: 100%;
  overflow: visible;
  background: transparent;
}

.chat-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  pointer-events: auto;
}

.chat-wrap.place-bottom,
.chat-wrap.place-left,
.chat-wrap.place-right {
  align-items: flex-start;
}

.bubble {
  position: relative;
  max-width: 190px;
  min-width: 80px;
  background: #fffaf3;
  border: 2px solid #d0b798;
  border-radius: 12px;
  padding: 6px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble-text {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: #3a2a1a;
  word-break: break-word;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.menu-row.has-text {
  border-top: 1px solid #e8ddd0;
  padding-top: 6px;
}

.menu-item {
  padding: 4px;
  color: #3a2a1a;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.menu-item:hover {
  background: #f0e6d6;
}
</style>
