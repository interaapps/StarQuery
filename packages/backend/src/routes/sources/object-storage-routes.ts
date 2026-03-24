import type { Express } from 'express'
import bodyParser from 'body-parser'
import type { AppContext } from '../../app-context.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { requirePermission } from '../../auth/middleware.ts'
import { dataSourcePermissionTargets, projectPermissionTargets } from '../../auth/permissions.ts'
import { normalizeDataSourceConfig } from '../../datasources/config.ts'
import { S3ResourceAdapter } from '../../datasources/resource/s3-adapter.ts'
import { sendSourceError } from '../source-route-errors.ts'
import { requireSource } from './shared.ts'

function getUploadContentType(req: { header(name: string): string | undefined }) {
  const headerValue = req.header('x-starquery-object-content-type') ?? req.header('content-type')
  if (!headerValue) {
    return null
  }

  const [contentType] = headerValue.split(';')
  return contentType?.trim() || null
}

export function registerObjectStorageSourceRoutes(app: Express, context: AppContext) {
  app.get('/api/projects/:projectId/sources/:sourceId/resources/download', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 's3' && source.type !== 'minio') {
      res.status(400).json({ error: 'This datasource does not support object downloads' })
      return
    }

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'view', 'read'),
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    const resourcePath = typeof req.query.path === 'string' ? req.query.path : ''
    if (!resourcePath.trim()) {
      res.status(400).json({ error: 'path is required' })
      return
    }

    const adapter = new S3ResourceAdapter(normalizeDataSourceConfig(source.type, source.config) as never)

    try {
      await adapter.connect()
      const download = await adapter.downloadObject(resourcePath)
      res.setHeader('Content-Type', download.contentType)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(download.fileName).replace(/%20/g, ' ')}"`,
      )
      if (typeof download.size === 'number') {
        res.setHeader('Content-Length', String(download.size))
      }

      download.stream.on('error', (error) => {
        if (!res.headersSent) {
          sendSourceError(res, error, 'The object could not be downloaded')
          return
        }

        res.destroy(error as Error)
      })
      download.stream.pipe(res)
    } catch (error) {
      sendSourceError(res, error, 'The object could not be downloaded')
    } finally {
      res.once('finish', () => {
        void adapter.close()
      })
      res.once('close', () => {
        void adapter.close()
      })
    }
  })

  app.put(
    '/api/projects/:projectId/sources/:sourceId/resources/object',
    bodyParser.raw({
      type: () => true,
      limit: context.config.requestBodyLimit,
    }),
    async (req, res) => {
      const authReq = req as AuthenticatedRequest
      const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
      if (!source) return

      if (source.type !== 's3' && source.type !== 'minio') {
        res.status(400).json({ error: 'This datasource does not support object uploads' })
        return
      }

      if (
        !requirePermission(authReq, res, [
          ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
          ...projectPermissionTargets(source.projectId, 'manage', 'write'),
        ])
      ) {
        return
      }

      const resourcePath = typeof req.query.path === 'string' ? req.query.path : ''
      if (!resourcePath.trim()) {
        res.status(400).json({ error: 'path is required' })
        return
      }

      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([])
      const adapter = new S3ResourceAdapter(normalizeDataSourceConfig(source.type, source.config) as never)

      try {
        await adapter.connect()
        const listing = await adapter.putObject(resourcePath, {
          body,
          contentType: getUploadContentType(req),
        })
        res.status(201).json(listing)
      } catch (error) {
        sendSourceError(res, error, 'The object could not be created')
      } finally {
        await adapter.close().catch(() => undefined)
      }
    },
  )

  app.delete('/api/projects/:projectId/sources/:sourceId/resources', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (source.type !== 's3' && source.type !== 'minio') {
      res.status(400).json({ error: 'This datasource does not support object deletion' })
      return
    }

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    const requestPaths = Array.isArray(req.body?.paths) ? req.body.paths : []
    const paths = requestPaths.filter((path): path is string => typeof path === 'string' && path.trim().length > 0)

    if (!paths.length) {
      res.status(400).json({ error: 'paths must contain at least one resource path' })
      return
    }

    const adapter = new S3ResourceAdapter(normalizeDataSourceConfig(source.type, source.config) as never)

    try {
      await adapter.connect()
      res.json(await adapter.deletePaths(paths))
    } catch (error) {
      sendSourceError(res, error, 'The selected resources could not be deleted')
    } finally {
      await adapter.close().catch(() => undefined)
    }
  })
}
