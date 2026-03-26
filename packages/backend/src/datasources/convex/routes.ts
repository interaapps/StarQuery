import type { Express } from 'express'
import type { AppContext } from '../../app-context.ts'
import { requirePermission } from '../../auth/middleware.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { dataSourceReadPermissionTargets, dataSourceWritePermissionTargets } from '../../auth/permissions.ts'
import { sendSourceError } from '../../routes/source-route-errors.ts'
import { requireSource } from '../../routes/sources/shared.ts'
import { convexDataSourceModule } from './index.ts'
import { ConvexResourceAdapter } from './adapter.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isConvexFunctionType(value: unknown): value is 'query' | 'mutation' | 'action' {
  return value === 'query' || value === 'mutation' || value === 'action'
}

export function registerConvexSourceRoutes(app: Express, context: AppContext) {
  app.post('/api/projects/:projectId/sources/:sourceId/convex/query', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'convex') {
      res.status(400).json({ error: 'This datasource is not backed by Convex.' })
      return
    }

    const { functionType, path, args } = req.body as {
      functionType?: unknown
      path?: unknown
      args?: unknown
    }

    if (!isConvexFunctionType(functionType)) {
      res.status(400).json({ error: 'functionType must be query, mutation, or action.' })
      return
    }

    if (typeof path !== 'string' || !path.trim()) {
      res.status(400).json({ error: 'A Convex function path is required.' })
      return
    }

    if (!isRecord(args)) {
      res.status(400).json({ error: 'args must be a JSON object.' })
      return
    }

    const permissionTargets =
      functionType === 'query'
        ? dataSourceReadPermissionTargets(source.projectId, source.id)
        : dataSourceWritePermissionTargets(source.projectId, source.id)

    if (!requirePermission(authReq, res, permissionTargets)) {
      return
    }

    try {
      const normalizedConfig = convexDataSourceModule.normalizeConfig(source.config) as {
        deploymentUrl: string
        adminKey?: string
        authToken?: string
      }
      const adapter = new ConvexResourceAdapter(normalizedConfig)
      res.json(
        await adapter.runFunction({
          functionType,
          path: path.trim(),
          args,
        }),
      )
    } catch (error) {
      sendSourceError(res, error, 'The Convex function could not be executed')
    }
  })
}
