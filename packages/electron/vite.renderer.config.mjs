import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const frontendRoot = fileURLToPath(new URL('../frontend', import.meta.url))
const frontendSrc = fileURLToPath(new URL('../frontend/src', import.meta.url))
const electronRendererOutDir = fileURLToPath(new URL('./.vite/renderer/main_window', import.meta.url))


export default defineConfig({
  root: frontendRoot,
  base: './',
  plugins: [vue(), tailwindcss()],
  optimizeDeps: {
    entries: ['index.html'],
  },
  resolve: {
    preserveSymlinks: false,
    alias: {
      '@': frontendSrc,
    },
  },
  server: {
    watch: {
      ignored: [`${frontendRoot}/dist/**`],
    },
  },
  build: {
    outDir: electronRendererOutDir,
  },
})
