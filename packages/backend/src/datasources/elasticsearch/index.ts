import { optionalString, requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { ElasticsearchResourceAdapter } from './adapter.ts'

type ElasticsearchConfig = {
  node: string
  username?: string
  password?: string
  apiKey?: string
  index?: string
}

function normalizeElasticsearchConfig(config: Record<string, unknown>): ElasticsearchConfig {
  return {
    node: requireString(config, 'node'),
    username: optionalString(config, 'username'),
    password: optionalString(config, 'password'),
    apiKey: optionalString(config, 'apiKey'),
    index: optionalString(config, 'index'),
  }
}

export const elasticsearchDataSourceModule = {
  definition: {
    type: 'elasticsearch',
    kind: 'search',
    label: 'Elasticsearch',
    icon: 'search',
    capabilities: {
      sqlQuery: false,
      tableBrowser: false,
      dataEditor: true,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['password', 'apiKey'],
  normalizeConfig: normalizeElasticsearchConfig,
  createResourceAdapter(config) {
    return new ElasticsearchResourceAdapter(config as ElasticsearchConfig)
  },
} satisfies DataSourceModule
