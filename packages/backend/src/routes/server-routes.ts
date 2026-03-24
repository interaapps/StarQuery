import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'
import { buildAuthStatus } from '../auth/middleware.ts'
import { listAvailableDataSourceDefinitions } from '../datasources/definitions.ts'

export function registerServerRoutes(app: Express, context: AppContext) {
  app.get('/api/server/info', async (_req, res) => {
    const auth = await buildAuthStatus(context)

    res.json({
      name: context.config.serverName,
      mode: context.config.mode,
      auth,
      capabilities: {
        projects: true,
        dataSources: listAvailableDataSourceDefinitions(context.config.mode),
      },
    })
  })
}
