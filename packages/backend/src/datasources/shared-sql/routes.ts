import type { Express, Response } from 'express'
import type { AppContext } from '../../app-context.ts'
import type { AuthenticatedRequest } from '../../auth/request.ts'
import { requirePermission } from '../../auth/middleware.ts'
import { dataSourcePermissionTargets } from '../../auth/permissions.ts'
import type {
  SQLCreateTableColumnInput,
  SQLSaveTableChangesInput,
} from '../../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { normalizeWhereClause } from '../../adapters/database/sql/shared/where-clause.ts'
import { isSqlDataSourceType } from '../registry.ts'
import { withSqlAdapter } from './adapter.ts'
import { sendSourceError } from '../../routes/source-route-errors.ts'
import { isReadOnlySql, requireSource } from '../../routes/sources/shared.ts'

function ensureSqlSource(
  source: Awaited<ReturnType<typeof requireSource>>,
  res: Response,
) {
  if (!source) {
    return null
  }

  if (!isSqlDataSourceType(source.type)) {
    res.status(400).json({ error: `Datasource type ${source.type} does not support SQL operations` })
    return null
  }

  return source
}

export function registerSqlSourceRoutes(app: Express, context: AppContext) {
  app.get('/api/projects/:projectId/sources/:sourceId/tables', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'view', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'query', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    res.json(await withSqlAdapter(requiredSource, async (adapter) => adapter.getTables()))
  })

  app.get('/api/projects/:projectId/sources/:sourceId/tables/:table', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'view', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'query', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    res.json(await withSqlAdapter(requiredSource, async (adapter) => adapter.getTableDetails(req.params.table)))
  })

  app.get('/api/projects/:projectId/sources/:sourceId/tables/:table/rows', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'view', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'query', 'read'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    const page = Number(req.query.page ?? '1')
    const pageSize = Number(req.query.pageSize ?? '50')
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortDirection = req.query.sortDirection === 'desc' ? 'desc' : 'asc'

    try {
      const where = typeof req.query.where === 'string' ? normalizeWhereClause(req.query.where) : undefined
      res.json(
        await withSqlAdapter(requiredSource, async (adapter) =>
          adapter.getTableRows({
            table: req.params.table,
            page,
            pageSize,
            sortBy,
            sortDirection,
            where,
          }),
        ),
      )
    } catch (error) {
      sendSourceError(res, error, 'Unable to load table rows', 400)
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/tables', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'table.edit', 'write'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { name, columns } = req.body as {
      name?: string
      columns?: SQLCreateTableColumnInput[]
    }

    if (!name?.trim() || !Array.isArray(columns)) {
      res.status(400).json({ error: 'Table name and columns are required' })
      return
    }

    try {
      await withSqlAdapter(requiredSource, async (adapter) => adapter.createTable(name.trim(), columns))
      res.status(201).json({ ok: true })
    } catch (error) {
      sendSourceError(res, error, 'The table could not be created')
    }
  })

  app.delete('/api/projects/:projectId/sources/:sourceId/tables/:table', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'table.edit', 'write'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    try {
      await withSqlAdapter(requiredSource, async (adapter) => adapter.dropTable(req.params.table))
      res.json({ ok: true })
    } catch (error) {
      sendSourceError(res, error, 'The table could not be dropped')
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/tables/:table/save', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'table.edit', 'write'),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    const payload = req.body as Omit<SQLSaveTableChangesInput, 'table'>

    try {
      res.json(
        await withSqlAdapter(requiredSource, async (adapter) =>
          adapter.saveTableChanges({
            table: req.params.table,
            primaryKeys: payload.primaryKeys,
            insertedRows: payload.insertedRows,
            updatedRows: payload.updatedRows,
            deletedRows: payload.deletedRows,
          }),
        ),
      )
    } catch (error) {
      sendSourceError(res, error, 'The table changes could not be saved')
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/query', async (req, res) => {
    const authReq = req as AuthenticatedRequest
    const requiredSource = ensureSqlSource(await requireSource(context, req.params.projectId, req.params.sourceId, res), res)
    if (!requiredSource) return

    const queryAccess = isReadOnlySql(String(req.body?.query ?? '')) ? 'read' : 'write'
    if (
      !requirePermission(authReq, res, [
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'query', queryAccess),
        ...dataSourcePermissionTargets(requiredSource.projectId, requiredSource.id, 'manage', 'write'),
      ])
    ) {
      return
    }

    const { query } = req.body as { query?: string }
    if (!query?.trim()) {
      res.status(400).json({ error: 'Query is required' })
      return
    }

    try {
      const results = await withSqlAdapter(requiredSource, async (adapter) => adapter.executeStatements(query))
      res.json({ results })
    } catch (error) {
      sendSourceError(res, error, 'The SQL query could not be executed')
    }
  })
}
