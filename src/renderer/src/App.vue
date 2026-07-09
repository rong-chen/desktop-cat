<template>
  <div class="window-area">
    <div
      class="cat-container"
      @mouseenter="onEnter"
      @mouseleave="onLeave"
    >
      <img
        class="cat-img"
        :src="currentGif"
        alt="desktop cat"
        draggable="false"
        @mousedown="startDrag"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import idleGif from './assets/gifs/idle.gif'

const currentGif = ref(idleGif)

function onEnter() {
  window.api.setIgnoreMouse(false)
  window.api.setChatMode('menu')
}

function onLeave() {
  window.api.setIgnoreMouse(true)
  window.api.setChatMode('chat')
}

function startDrag(e) {
  let lastX = e.screenX
  let lastY = e.screenY

  const onMove = (ev) => {
    const dx = ev.screenX - lastX
    const dy = ev.screenY - lastY
    lastX = ev.screenX
    lastY = ev.screenY
    window.api.moveWindow(dx, dy)
  }

  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
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

.window-area {
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.cat-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cat-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
  cursor: grab;
}

.cat-img:active {
  cursor: grabbing;
}
</style>
