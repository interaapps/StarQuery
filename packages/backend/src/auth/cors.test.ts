import test from 'node:test'
import assert from 'node:assert/strict'
import type { AppConfig } from '../config/app-config.ts'
import { createCorsOptions } from './cors.ts'

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    host: '127.0.0.1',
    publicUrl: undefined,
    corsAllowedOrigins: [],
    serverName: 'Hosted Server',
    mode: 'hosted',
    requestBodyLimit: '10mb',
    auth: {
      enabled: true,
      sessionTtlHours: 720,
      apiKeyTtlDays: 365,
      rateLimitWindowMs: 600000,
      rateLimitMaxAttempts: 10,
      oidcStateTtlMinutes: 15,
    },
    metaStore: {
      driver: 'sqlite',
      sqlitePath: '/tmp/starquery-auth-cors-test.sqlite',
      mysql: {
        host: '127.0.0.1',
        port: 3306,
        user: 'starquery',
        password: 'starquery',
        database: 'starquery',
      },
    },
    ...overrides,
  }
}

async function evaluateOrigin(config: AppConfig, origin?: string) {
  const options = createCorsOptions(config)
  if (typeof options.origin !== 'function') {
    return options.origin
  }

  return await new Promise<boolean>((resolve, reject) => {
    options.origin!(origin, (error, allowed) => {
      if (error) {
        reject(error)
        return
      }

      resolve(Boolean(allowed))
    })
  })
}

test('hosted CORS allows the configured public origin', async () => {
  const config = createConfig({ publicUrl: 'https://app.example.com/' })
  assert.equal(await evaluateOrigin(config, 'https://app.example.com'), true)
  assert.equal(await evaluateOrigin(config, 'https://evil.example.com'), false)
})

test('local mode keeps broad CORS for the desktop app flow', () => {
  const config = createConfig({ mode: 'local' })
  const options = createCorsOptions(config)
  assert.equal(options.origin, true)
})
