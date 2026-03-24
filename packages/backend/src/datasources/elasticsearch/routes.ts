import type { Express } from 'express'
import type { AppContext } from '../../app-context.ts'
import { requirePermission } from '../../auth/middleware.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { dataSourcePermissionTargets, projectPermissionTargets } from '../../auth/permissions.ts'
import { normalizeDataSourceConfig } from '../registry.ts'
import {
  ElasticsearchResourceAdapter,
  type ElasticsearchDocumentMutation,
} from './adapter.ts'
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

function isMutationRecordList(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((entry) => isRecord(entry))
}

function isMutationUpdateList(
  value: unknown,
): value is Array<{
  id: string
  document: Record<string, unknown>
}> {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.id === 'string' &&
        entry.id.trim().length > 0 &&
        isRecord(entry.document),
    )
  )
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

export function registerElasticsearchSourceRoutes(app: Express, context: AppContext) {
  app.post('/api/projects/:projectId/sources/:sourceId/elasticsearch/search', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'elasticsearch') {
      res.status(400).json({ error: 'This datasource does not support Elasticsearch search' })
      return
    }

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'query', 'read'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'view', 'read'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { index, body, from, size, trackTotalHits } = req.body as {
      index?: string
      body?: unknown
      from?: unknown
      size?: unknown
      trackTotalHits?: unknown
    }

    if (!index || typeof index !== 'string' || !index.trim()) {
      res.status(400).json({ error: 'index is required' })
      return
    }

    if (!isRecord(body)) {
      res.status(400).json({ error: 'body must be a JSON object' })
      return
    }

    const searchRequest: Record<string, unknown> = {
      ...body,
      from: parseNonNegativeInteger(from, parseNonNegativeInteger(body.from, 0)),
      size: Math.min(parseNonNegativeInteger(size, parseNonNegativeInteger(body.size, 100)), 1000),
      track_total_hits:
        typeof trackTotalHits === 'boolean'
          ? trackTotalHits
          : typeof body.track_total_hits === 'boolean'
            ? body.track_total_hits
            : true,
    }

    const adapter = new ElasticsearchResourceAdapter(
      normalizeDataSourceConfig('elasticsearch', source.config) as never,
    )

    try {
      await adapter.connect()
      res.json(await adapter.searchIndex(index.trim(), searchRequest))
    } catch (error) {
      sendSourceError(res, error, 'The Elasticsearch query could not be executed')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/elasticsearch/save', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 'elasticsearch') {
      res.status(400).json({ error: 'This datasource does not support Elasticsearch document editing' })
      return
    }

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'query', 'write'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { index, inserted, updated, deleted } = req.body as {
      index?: unknown
      inserted?: unknown
      updated?: unknown
      deleted?: unknown
    }

    if (typeof index !== 'string' || !index.trim()) {
      res.status(400).json({ error: 'index is required' })
      return
    }

    if (inserted !== undefined && !isMutationRecordList(inserted)) {
      res.status(400).json({ error: 'inserted must be an array of JSON objects' })
      return
    }

    if (updated !== undefined && !isMutationUpdateList(updated)) {
      res.status(400).json({ error: 'updated must be an array of document update objects' })
      return
    }

    if (deleted !== undefined && !isStringList(deleted)) {
      res.status(400).json({ error: 'deleted must be an array of document ids' })
      return
    }

    const safeInserted = isMutationRecordList(inserted) ? inserted : []
    const safeUpdated = isMutationUpdateList(updated) ? updated : []
    const safeDeleted = isStringList(deleted) ? deleted : []

    const mutations: ElasticsearchDocumentMutation = {
      inserted: safeInserted.filter((entry): entry is Record<string, unknown> => isRecord(entry)),
      updated: safeUpdated.filter(
        (entry): entry is { id: string; document: Record<string, unknown> } =>
          isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.document),
      ),
      deleted: safeDeleted.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0),
    }

    const adapter = new ElasticsearchResourceAdapter(
      normalizeDataSourceConfig('elasticsearch', source.config) as never,
    )

    try {
      await adapter.connect()
      res.json(await adapter.saveDocuments(index.trim(), mutations))
    } catch (error) {
      sendSourceError(res, error, 'The Elasticsearch documents could not be saved')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })
}
