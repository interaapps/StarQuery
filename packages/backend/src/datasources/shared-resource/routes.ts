import type { Express } from 'express'
import type { AppContext } from '../../app-context.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { requirePermission } from '../../auth/middleware.ts'
import { dataSourcePermissionTargets } from '../../auth/permissions.ts'
import { getDataSourceDefinition } from '../registry.ts'
import { withResourceAdapter } from './adapter.ts'
import { sendSourceError } from '../../routes/source-route-errors.ts'
import { requireSource } from '../../routes/sources/shared.ts'

function parseListLimit(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return Math.max(1, Math.floor(parsed))
}

export function registerResourceSourceRoutes(app: Express, context: AppContext) {
  app.get('/api/projects/:projectId/sources/:sourceId/resources', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const definition = getDataSourceDefinition(source.type)
    if (!definition.capabilities.resourceBrowser) {
      res.status(400).json({ error: `Datasource type ${source.type} does not support resource browsing` })
      return
    }

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'view', 'read'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'query', 'read'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    try {
      const path = typeof req.query.path === 'string' ? req.query.path : ''
      const search = typeof req.query.search === 'string' ? req.query.search : undefined
      const limit = parseListLimit(req.query.limit)
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined
      res.json(await withResourceAdapter(source, async (adapter) => adapter.list(path, { search, limit, cursor })))
    } catch (error) {
      sendSourceError(res, error, 'The datasource resources could not be loaded')
    }
  })
}
