import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: 'src/main/index.js'
      },
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
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    optimizeDeps: {
      exclude: ['node-screenshots']
    },
    build: {
      rollupOptions: {
        external: ['path', 'fs'],
        input: {
          index: resolve('src/renderer/cat/index.html'),
          chat: resolve('src/renderer/chat/index.html'),
          settings: resolve('src/renderer/settings/index.html'),
          clipboard: resolve('src/renderer/clipboard/index.html'),
          'json-viewer': resolve('src/renderer/json-viewer/index.html'),
          tasks: resolve('src/renderer/tasks/index.html'),
          notify: resolve('src/renderer/notify/index.html'),
          screenshot: resolve('src/renderer/screenshot/index.html'),
          report: resolve('src/renderer/report/index.html')
        }
      }
    }
  }
})
