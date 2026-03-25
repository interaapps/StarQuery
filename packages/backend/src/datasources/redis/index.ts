import { optionalBoolean, optionalString, requirePort } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { RedisResourceAdapter } from './adapter.ts'

export const redisDataSourceModule = {
  definition: {
    type: 'redis',
    kind: 'resource',
    label: 'Redis',
    icon: 'database',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    return {
      host: optionalString(config, 'host') ?? '127.0.0.1',
      port: requirePort(config, 6379),
      username: optionalString(config, 'username'),
      password: optionalString(config, 'password'),
      database: Number(config.database ?? 0),
      ssl: optionalBoolean(config, 'ssl', false),
    }
  },
  createResourceAdapter(config) {
    return new RedisResourceAdapter(
      config as {
        host: string
        port: number
        username?: string
        password?: string
        database?: number
        ssl?: boolean
      },
    )
  },
} satisfies DataSourceModule
