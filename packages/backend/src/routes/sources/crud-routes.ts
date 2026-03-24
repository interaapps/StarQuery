import type { Express } from 'express'
import type { AppContext } from '../../app-context.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { requireAuthenticated, requirePermission } from '../../auth/middleware.ts'
import { dataSourcePermissionTargets, projectPermissionTargets } from '../../auth/permissions.ts'
import { getDataSourceDefinition, isKnownDataSourceType } from '../../datasources/definitions.ts'
import { normalizeDataSourceConfig } from '../../datasources/config.ts'
import type { DataSourceRecord } from '../../meta/types.ts'
import { mergeDataSourceConfig, sanitizeDataSourceRecord } from '../../datasources/shared/secrets.ts'
import { canViewSource, requireProject, requireSource } from './shared.ts'

export function registerSourceCrudRoutes(app: Express, context: AppContext) {
  app.get('/api/projects/:projectId/sources', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    if (!requireAuthenticated(authReq, res)) return

    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    const sources = await context.metaStore.listDataSources(project.id)
    res.json(sources.filter((source) => canViewSource(authReq, project.id, source.id)).map(sanitizeDataSourceRecord))
  })

  app.post('/api/projects/:projectId/sources', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(project.id, '*', 'manage', 'write'),
        ...projectPermissionTargets(project.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { name, type, config } = req.body as {
      name?: string
      type?: string
      config?: Record<string, unknown>
    }

    if (!name?.trim() || !type || !config || !isKnownDataSourceType(type)) {
      res.status(400).json({ error: 'name, type and config are required' })
      return
    }

    const definition = getDataSourceDefinition(type)
    if (!definition || (definition.localOnly && context.config.mode !== 'local')) {
      res.status(400).json({ error: `${type} datasources are not available on this server` })
      return
    }

    const normalizedConfig = normalizeDataSourceConfig(type, config)
    const sources = await context.metaStore.listDataSources(project.id)
    const source = await context.metaStore.createDataSource({
      projectId: project.id,
      name: name.trim(),
      type,
      config: normalizedConfig,
      position: sources.length,
    })

    res.status(201).json(sanitizeDataSourceRecord(source))
  })

  app.put('/api/projects/:projectId/sources/:sourceId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { name, type, config, position } = req.body as {
      name?: string
      type?: DataSourceRecord['type']
      config?: Record<string, unknown>
      position?: number
    }

    const nextType = type ?? source.type
    const definition = getDataSourceDefinition(nextType)
    if (!definition || (definition.localOnly && context.config.mode !== 'local')) {
      res.status(400).json({ error: `${nextType} datasources are not available on this server` })
      return
    }

    const nextConfig = normalizeDataSourceConfig(nextType, mergeDataSourceConfig(source, nextType, config))
    const updated = await context.metaStore.updateDataSource(source.id, {
      name: name?.trim() || source.name,
      type: nextType,
      config: nextConfig,
      position,
    })

    res.json(sanitizeDataSourceRecord(updated))
  })

  app.delete('/api/projects/:projectId/sources/:sourceId', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(source.projectId, source.id, 'manage', 'write'),
        ...projectPermissionTargets(source.projectId, 'manage', 'write'),
      ])
    ) {
      return
    }

    await context.metaStore.deleteDataSource(source.id)
    res.json({ ok: true })
  })
}
