import test from 'node:test'
import assert from 'node:assert/strict'
import type { AppContext } from '../app-context.ts'
import type { AuthenticatedRequest } from './request.ts'
import { authenticateRequest } from './middleware.ts'
import { hashAuthToken } from './tokens.ts'

function createContext(overrides: Partial<AppContext['config']> = {}, metaStoreOverrides: Partial<AppContext['metaStore']> = {}) {
  return {
    config: {
      port: 3000,
      host: '127.0.0.1',
      publicUrl: undefined,
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
        sqlitePath: '/tmp/test.sqlite',
        mysql: {
          host: '127.0.0.1',
          port: 3306,
          user: 'starquery',
          password: 'starquery',
          database: 'starquery',
        },
      },
      ...overrides,
    },
    metaStore: {
      getAuthTokenByHash: async () => null,
      deleteAuthToken: async () => undefined,
      getUserWithRoles: async () => null,
      updateAuthTokenLastUsed: async () => undefined,
      countUsers: async () => 0,
      ...metaStoreOverrides,
    },
  } as unknown as AppContext
}

function createRequest(token?: string) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as AuthenticatedRequest
}

test('authenticateRequest grants full local access when auth is disabled', async () => {
  const context = createContext({
    mode: 'local',
    auth: {
      enabled: false,
      sessionTtlHours: 720,
      apiKeyTtlDays: 365,
      rateLimitWindowMs: 600000,
      rateLimitMaxAttempts: 10,
      oidcStateTtlMinutes: 15,
    },
  })
  const req = createRequest()

  const auth = await authenticateRequest(context, req)

  assert.equal(auth.kind, 'local')
  assert.deepEqual(auth.permissions, ['*'])
})

test('authenticateRequest rejects expired tokens and deletes them', async () => {
  const deletions: string[] = []
  const rawToken = 'expired-token'
  const context = createContext(
    {},
    {
      getAuthTokenByHash: async (tokenHash: string) =>
        tokenHash === hashAuthToken(rawToken)
          ? {
              id: 'token-1',
              userId: 'user-1',
              kind: 'session',
              name: 'Expired',
              tokenPrefix: 'expired',
              tokenHash,
              storage: 'local',
              expiresAt: '2000-01-01T00:00:00.000Z',
              lastUsedAt: null,
              createdAt: '2000-01-01T00:00:00.000Z',
            }
          : null,
      deleteAuthToken: async (tokenId: string) => {
        deletions.push(tokenId)
      },
    },
  )
  const req = createRequest(rawToken)

  const auth = await authenticateRequest(context, req)

  assert.equal(auth.kind, 'anonymous')
  assert.deepEqual(deletions, ['token-1'])
})
