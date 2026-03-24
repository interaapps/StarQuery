import test from 'node:test'
import assert from 'node:assert/strict'
import type { AppConfig } from '../config/app-config.ts'
import { getAppBaseUrl, resolveSafeReturnTo } from './url.ts'
import type { AuthenticatedRequest } from './request.ts'

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
      sqlitePath: '/tmp/starquery-auth-url-test.sqlite',
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

function createRequest(protocol = 'http', host = 'localhost:3000') {
  return {
    protocol,
    get(header: string) {
      return header.toLowerCase() === 'host' ? host : undefined
    },
  } as AuthenticatedRequest
}

test('getAppBaseUrl prefers configured publicUrl over request headers', () => {
  const config = createConfig({ publicUrl: 'https://app.example.com/' })
  const req = createRequest('http', 'evil.example.com')

  assert.equal(getAppBaseUrl(config, req), 'https://app.example.com/')
})

test('resolveSafeReturnTo allows relative paths on the same origin', () => {
  const config = createConfig({ publicUrl: 'https://app.example.com/' })
  const req = createRequest()

  assert.equal(resolveSafeReturnTo(config, req, '/workspaces/demo'), 'https://app.example.com/workspaces/demo')
})

test('resolveSafeReturnTo rejects external redirect targets', () => {
  const config = createConfig({ publicUrl: 'https://app.example.com/' })
  const req = createRequest()

  assert.throws(
    () => resolveSafeReturnTo(config, req, 'https://evil.example.com/steal'),
    /same origin/u,
  )
})
