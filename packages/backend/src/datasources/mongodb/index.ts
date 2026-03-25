import { optionalBoolean, optionalString, requirePort } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { MongoDbResourceAdapter } from './adapter.ts'

export const mongodbDataSourceModule = {
  definition: {
    type: 'mongodb',
    kind: 'resource',
    label: 'MongoDB',
    icon: 'brand-mongodb',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      dataEditor: true,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['password'],
  normalizeConfig(config) {
    const uri = optionalString(config, 'uri')

    return {
      uri,
      host: optionalString(config, 'host') ?? '127.0.0.1',
      port: requirePort(config, 27017),
      username: optionalString(config, 'username'),
      password: optionalString(config, 'password'),
      database: optionalString(config, 'database'),
      authSource: optionalString(config, 'authSource'),
      ssl: optionalBoolean(config, 'ssl', false),
    }
  },
  createResourceAdapter(config) {
    return new MongoDbResourceAdapter(
      config as {
        uri?: string
        host?: string
        port?: number
        username?: string
        password?: string
        database?: string
        authSource?: string
        ssl?: boolean
      },
    )
  },
} satisfies DataSourceModule
