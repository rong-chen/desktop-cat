import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['node-screenshots']
      }
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/cat/index.html'),
          chat: resolve('src/renderer/chat/index.html'),
          settings: resolve('src/renderer/settings/index.html'),
          clipboard: resolve('src/renderer/clipboard/index.html'),
          'json-viewer': resolve('src/renderer/json-viewer/index.html'),
          tasks: resolve('src/renderer/tasks/index.html'),
          notify: resolve('src/renderer/notify/index.html'),
          screenshot: resolve('src/renderer/screenshot/index.html')
        }
      }
    }
  }
})
