import type { Express } from 'express'
import type { AppContext } from '../../app-context.ts'
import { requirePermission } from '../../auth/middleware.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { dataSourceReadPermissionTargets, dataSourceWritePermissionTargets } from '../../auth/permissions.ts'
import { normalizeDataSourceConfig } from '../registry.ts'
import { MongoDbResourceAdapter } from './adapter.ts'
import { sendSourceError } from '../../routes/source-route-errors.ts'
import { requireSource } from '../../routes/sources/shared.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseNonNegativeInteger(value: unknown, fallback: number) {
  const nextValue = Number(value)
  if (!Number.isFinite(nextValue) || nextValue < 0) {
    return fallback
  }

  return Math.floor(nextValue)
}

function parseMongoCollectionTarget(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const database = typeof value.database === 'string' ? value.database.trim() : ''
  const collection = typeof value.collection === 'string' ? value.collection.trim() : ''

  if (!database || !collection) {
    return null
  }

  return {
    database,
    collection,
  }
}

function createMongoAdapter(source: { config: Record<string, unknown> }) {
  return new MongoDbResourceAdapter(normalizeDataSourceConfig('mongodb', source.config) as never)
}

export function registerMongoDbSourceRoutes(app: Express, context: AppContext) {
  app.post('/api/projects/:projectId/sources/:sourceId/mongodb/query', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB queries' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceReadPermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    if (!target) {
      res.status(400).json({ error: 'database and collection are required' })
      return
    }

    const filter = req.body?.filter
    const sort = req.body?.sort
    const projection = req.body?.projection

    if (filter !== undefined && !isRecord(filter)) {
      res.status(400).json({ error: 'filter must be a JSON object' })
      return
    }

    if (sort !== undefined && !isRecord(sort)) {
      res.status(400).json({ error: 'sort must be a JSON object' })
      return
    }

    if (projection !== undefined && !isRecord(projection)) {
      res.status(400).json({ error: 'projection must be a JSON object' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.json(
        await adapter.queryCollection({
          ...target,
          filter,
          sort,
          projection,
          skip: parseNonNegativeInteger(req.body?.skip, 0),
          limit: Math.min(parseNonNegativeInteger(req.body?.limit, 50), 500),
        }),
      )
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB documents could not be loaded')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/mongodb/document', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB document creation' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceWritePermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    if (!target || !isRecord(req.body?.document)) {
      res.status(400).json({ error: 'database, collection and document are required' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.status(201).json(
        await adapter.insertDocument({
          ...target,
          document: req.body.document,
        }),
      )
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB document could not be created')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.put('/api/projects/:projectId/sources/:sourceId/mongodb/document', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB document editing' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceWritePermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    if (!target || req.body?.id === undefined || !isRecord(req.body?.document)) {
      res.status(400).json({ error: 'database, collection, id and document are required' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.json(
        await adapter.replaceDocument({
          ...target,
          id: req.body.id,
          document: req.body.document,
        }),
      )
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB document could not be saved')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.delete('/api/projects/:projectId/sources/:sourceId/mongodb/documents', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB document deletion' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceWritePermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    if (!target || !ids.length) {
      res.status(400).json({ error: 'database, collection and ids are required' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.json(
        await adapter.deleteDocuments({
          ...target,
          ids,
        }),
      )
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB documents could not be deleted')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/mongodb/collections', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB collection creation' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceWritePermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    if (!target) {
      res.status(400).json({ error: 'database and collection are required' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.status(201).json(await adapter.createCollection(target.database, target.collection))
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB collection could not be created')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.delete('/api/projects/:projectId/sources/:sourceId/mongodb/collections', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'mongodb') {
      res.status(400).json({ error: 'This datasource does not support MongoDB collection deletion' })
      return
    }

    if (
      !requirePermission(authReq, res, dataSourceWritePermissionTargets(source.projectId, source.id))
    ) {
      return
    }

    const target = parseMongoCollectionTarget(req.body)
    if (!target) {
      res.status(400).json({ error: 'database and collection are required' })
      return
    }

    const adapter = createMongoAdapter(source)

    try {
      await adapter.connect()
      res.json(await adapter.deleteCollection(target.database, target.collection))
    } catch (error) {
      sendSourceError(res, error, 'The MongoDB collection could not be deleted')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })
}
