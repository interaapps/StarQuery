import { optionalString, requireString } from '../shared/config-helpers.ts'
import type { DataSourceModule } from '../shared/module.ts'
import { ConvexResourceAdapter } from './adapter.ts'

export const convexDataSourceModule = {
  definition: {
    type: 'convex',
    kind: 'resource',
    label: 'Convex',
    icon: 'stack-2',
    capabilities: {
      sqlQuery: false,
      queryConsole: true,
      tableBrowser: false,
      dataEditor: false,
      schemaEditor: false,
      resourceBrowser: true,
    },
  },
  secretFields: ['adminKey', 'authToken'],
  normalizeConfig(config) {
    return {
      deploymentUrl: requireString(config, 'deploymentUrl', 'deployment URL'),
      adminKey: optionalString(config, 'adminKey'),
      authToken: optionalString(config, 'authToken'),
    }
  },
  createResourceAdapter(config) {
    return new ConvexResourceAdapter(
      config as {
        deploymentUrl: string
        adminKey?: string
        authToken?: string
      },
    )
  },
} satisfies DataSourceModule
