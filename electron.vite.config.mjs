import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          chat: resolve('src/renderer/chat.html'),
          settings: resolve('src/renderer/settings.html'),
          clipboard: resolve('src/renderer/clipboard.html'),
          'json-viewer': resolve('src/renderer/json-viewer.html'),
          tasks: resolve('src/renderer/tasks.html'),
          notify: resolve('src/renderer/notify.html')
        }
      }
    }
  }
})
