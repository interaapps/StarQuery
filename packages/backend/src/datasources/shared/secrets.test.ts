import test from 'node:test'
import assert from 'node:assert/strict'
import { REDACTED_PASSWORD, mergeDataSourceConfig, sanitizeDataSourceRecord } from './secrets.ts'

test('sanitizeDataSourceRecord redacts nested SSH and TLS secrets', () => {
  const sanitized = sanitizeDataSourceRecord({
    id: 'source-1',
    projectId: 'project-1',
    name: 'warehouse',
    type: 'mysql',
    position: 0,
    config: {
      host: 'db.internal',
      port: 3306,
      user: 'app',
      password: 'database-secret',
      database: 'warehouse',
      ssh: {
        enabled: true,
        host: 'bastion.internal',
        port: 22,
        username: 'tunnel',
        authMethod: 'password',
        password: 'ssh-secret',
      },
      tls: {
        mode: 'verify-full',
        clientKeyPassphrase: 'tls-secret',
      },
    },
  })

  assert.equal(sanitized.config.password, REDACTED_PASSWORD)
  assert.equal((sanitized.config.ssh as Record<string, unknown>).password, REDACTED_PASSWORD)
  assert.equal((sanitized.config.tls as Record<string, unknown>).clientKeyPassphrase, REDACTED_PASSWORD)
})

test('mergeDataSourceConfig preserves redacted nested secrets while applying other changes', () => {
  const merged = mergeDataSourceConfig(
    {
      id: 'source-1',
      projectId: 'project-1',
      name: 'warehouse',
      type: 'mysql',
      position: 0,
      config: {
        host: 'db.internal',
        port: 3306,
        user: 'app',
        password: 'database-secret',
        database: 'warehouse',
        ssh: {
          enabled: true,
          host: 'bastion.internal',
          port: 22,
          username: 'tunnel',
          authMethod: 'password',
          password: 'ssh-secret',
        },
        tls: {
          mode: 'verify-full',
          clientKeyPassphrase: 'tls-secret',
        },
      },
    },
    'mysql',
    {
      host: 'db.internal',
      port: 3307,
      ssh: {
        enabled: true,
        host: 'bastion.internal',
        port: 22,
        username: 'tunnel',
        authMethod: 'password',
        password: REDACTED_PASSWORD,
      },
      tls: {
        mode: 'verify-ca',
        clientKeyPassphrase: REDACTED_PASSWORD,
      },
    },
  )

  assert.equal(merged.port, 3307)
  assert.equal((merged.ssh as Record<string, unknown>).password, 'ssh-secret')
  assert.equal((merged.tls as Record<string, unknown>).clientKeyPassphrase, 'tls-secret')
  assert.equal((merged.tls as Record<string, unknown>).mode, 'verify-ca')
})
