<template>
  <div class="chat-wrap" :class="['place-' + placement]">
    <div class="bubble" @mouseenter="onEnter" @mouseleave="onLeave">
      <div class="menu-row" v-if="mode === 'menu'">
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
      <div class="bubble-text" v-else>{{ text }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon, addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'

addCollection(mdiIcons)

const text = ref('')
const mode = ref('menu')
const placement = ref('top')

onMounted(() => {
  window.api.onChatUpdate((data) => {
    if (data.text !== undefined) text.value = data.text
    if (data.mode) mode.value = data.mode
    if (data.placement) placement.value = data.placement
  })
})

function onEnter() {
  window.api.setIgnoreMouse(false)
  window.api.setChatMode('menu')
}

function onLeave() {
  window.api.setIgnoreMouse(true)
  window.api.setChatMode('chat')
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
  overflow: hidden;
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
  max-height: calc(100% - 8px);
  overflow-y: auto;
  background: #fffaf3;
  border: 2px solid #d0b798;
  border-radius: 12px;
  padding: 6px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
