<template>
  <div class="notify-page" @click="close">
    <div class="notify-box">
      <div class="notify-message">{{ message }}</div>
      <div class="notify-hint">点击任意位置关闭</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const message = ref('')

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  message.value = params.get('msg') || '提醒'
})

function close() {
  window.api.closeNotify()
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
}

.notify-page {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  animation: fadeIn 0.3s ease;
  background: rgba(0, 0, 0, 0.4);
}

.notify-box {
  background: rgba(255, 250, 243, 0.95);
  border: 3px solid #d0b798;
  border-radius: 20px;
  padding: 60px 80px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.notify-message {
  font-size: 36px;
  font-weight: 600;
  color: #3a2a1a;
  margin-bottom: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.notify-hint {
  font-size: 13px;
  color: #b0a090;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
</style>
