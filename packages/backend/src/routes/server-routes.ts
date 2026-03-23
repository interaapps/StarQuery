import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'

export function registerServerRoutes(app: Express, context: AppContext) {
  app.get('/api/server/info', (_req, res) => {
    const dataSources =
      context.config.mode === 'local' ? ['mysql', 'postgres', 'sqlite'] : ['mysql', 'postgres']

    res.json({
      name: context.config.serverName,
      mode: context.config.mode,
      capabilities: {
        projects: true,
        dataSources,
      },
    })
  })
}
