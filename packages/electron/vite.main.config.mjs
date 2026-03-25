import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const pgNativeShim = fileURLToPath(new URL('./src/shims/pg-native.cjs', import.meta.url))
const backendDrizzleMigrationsPath = fileURLToPath(new URL('../backend/src/meta/drizzle', import.meta.url))
const externalNativePackages = [
  '@duckdb/node-api',
  '@duckdb/node-bindings',
]

function isExternalNativeModuleId(id) {
  return (
    externalNativePackages.includes(id) ||
    id.startsWith('@duckdb/node-bindings-') ||
    id.endsWith('.node') ||
    id.includes('/node_modules/@duckdb/node-api/') ||
    id.includes('/node_modules/@duckdb/node-bindings')
  )
}

function patchNamespaceInteropHelper() {
  return {
    name: 'patch-namespace-interop-helper',
    renderChunk(code) {
      if (!code.includes('function _interopNamespaceDefault')) {
        return null
      }

      return {
        code: code.replaceAll(
          'Object.defineProperty(n, k, d.get ? d : {',
          'Object.defineProperty(n, k, d && d.get ? d : {',
        ),
        map: null,
      }
    },
  }
}

function copyMetaMigrationsPlugin() {
  return {
    name: 'copy-meta-drizzle-migrations',
    writeBundle(outputOptions) {
      const outputDir = outputOptions.dir
      if (!outputDir) {
        return
      }

      const targetPath = path.join(outputDir, 'drizzle')
      fs.rmSync(targetPath, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.cpSync(backendDrizzleMigrationsPath, targetPath, {
        recursive: true,
        force: true,
      })
    },
  }
}

function externalizeNativeModulesPlugin() {
  return {
    name: 'externalize-native-modules',
    resolveId(source) {
      if (isExternalNativeModuleId(source)) {
        return { id: source, external: true }
      }

      return null
    },
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      external(id) {
        return isExternalNativeModuleId(id)
      },
    },
  },
  resolve: {
    alias: {
      'pg-native': pgNativeShim,
    },
  },
  plugins: [
    externalizeNativeModulesPlugin(),
    patchNamespaceInteropHelper(),
    copyMetaMigrationsPlugin(),
  ],
})
