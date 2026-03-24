import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

function normalizePluginOptions(plugin: unknown): PluginOption[] {
  return Array.isArray(plugin)
    ? (plugin as PluginOption[])
    : [plugin as PluginOption]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue() as PluginOption,
    vueDevTools() as PluginOption,
    ...normalizePluginOptions(tailwindcss()),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
