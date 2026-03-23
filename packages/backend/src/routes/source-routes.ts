import type { Express, Response } from 'express'
import type { AppContext } from '../app-context.ts'
import type {
  SQLCreateTableColumnInput,
  SQLSaveTableChangesInput,
} from '../adapters/database/sql/default-sql-adapter/DefaultSQLAdapter.ts'
import { normalizeWhereClause } from '../adapters/database/sql/shared/where-clause.ts'
import { sendSourceError } from './source-route-errors.ts'
import { withSqlAdapter, validateDataSourceConfig } from '../services/source-connections.ts'

async function requireProject(context: AppContext, projectId: string, res: Response) {
  const project = await context.metaStore.getProjectById(projectId)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return null
  }

  return project
}

async function requireSource(context: AppContext, projectId: string, sourceId: string, res: Response) {
  const source = await context.metaStore.getDataSource(sourceId)

  if (!source || source.projectId !== projectId) {
    res.status(404).json({ error: 'Datasource not found' })
    return null
  }

  return source
}

export function registerSourceRoutes(app: Express, context: AppContext) {
  app.get('/api/projects/:projectId/sources', async (req, res) => {
    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    res.json(await context.metaStore.listDataSources(project.id))
  })

  app.post('/api/projects/:projectId/sources', async (req, res) => {
    const project = await requireProject(context, req.params.projectId, res)
    if (!project) return

    const { name, type, config } = req.body as {
      name?: string
      type?: 'mysql' | 'postgres' | 'sqlite'
      config?: Record<string, unknown>
    }

    if (!name?.trim() || !type || !config) {
      res.status(400).json({ error: 'name, type and config are required' })
      return
    }

    if (type === 'sqlite' && context.config.mode !== 'local') {
      res.status(400).json({ error: 'SQLite datasources are only available on local servers' })
      return
    }

    validateDataSourceConfig(type, config)

    const sources = await context.metaStore.listDataSources(project.id)
    const source = await context.metaStore.createDataSource({
      projectId: project.id,
      name: name.trim(),
      type,
      config,
      position: sources.length,
    })

    res.status(201).json(source)
  })

  app.put('/api/projects/:projectId/sources/:sourceId', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const { name, type, config, position } = req.body as {
      name?: string
      type?: 'mysql' | 'postgres' | 'sqlite'
      config?: Record<string, unknown>
      position?: number
    }

    const nextType = type ?? source.type
    const nextConfig = config ?? source.config

    if (nextType === 'sqlite' && context.config.mode !== 'local') {
      res.status(400).json({ error: 'SQLite datasources are only available on local servers' })
      return
    }

    validateDataSourceConfig(nextType, nextConfig)

    const updated = await context.metaStore.updateDataSource(source.id, {
      name: name?.trim() || source.name,
      type: nextType,
      config: nextConfig,
      position,
    })

    res.json(updated)
  })

  app.delete('/api/projects/:projectId/sources/:sourceId', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    await context.metaStore.deleteDataSource(source.id)
    res.json({ ok: true })
  })

  app.get('/api/projects/:projectId/sources/:sourceId/tables', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    res.json(await withSqlAdapter(source, async (adapter) => adapter.getTables()))
  })

  app.get('/api/projects/:projectId/sources/:sourceId/tables/:table', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    res.json(await withSqlAdapter(source, async (adapter) => adapter.getTableDetails(req.params.table)))
  })

  app.get('/api/projects/:projectId/sources/:sourceId/tables/:table/rows', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const page = Number(req.query.page ?? '1')
    const pageSize = Number(req.query.pageSize ?? '50')
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : undefined
    const sortDirection = req.query.sortDirection === 'desc' ? 'desc' : 'asc'

    try {
      const where = typeof req.query.where === 'string' ? normalizeWhereClause(req.query.where) : undefined

      res.json(
        await withSqlAdapter(source, async (adapter) =>
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
      const message = error instanceof Error ? error.message : 'Unable to load table rows'
      const status = message.includes('was not found') ? 404 : 400
      sendSourceError(res, error, 'Unable to load table rows', status)
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/tables', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const { name, columns } = req.body as {
      name?: string
      columns?: SQLCreateTableColumnInput[]
    }

    if (!name?.trim() || !Array.isArray(columns)) {
      res.status(400).json({ error: 'Table name and columns are required' })
      return
    }

    try {
      await withSqlAdapter(source, async (adapter) => adapter.createTable(name.trim(), columns))
      res.status(201).json({ ok: true })
    } catch (error) {
      sendSourceError(res, error, 'The table could not be created')
    }
  })

  app.delete('/api/projects/:projectId/sources/:sourceId/tables/:table', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    try {
      await withSqlAdapter(source, async (adapter) => adapter.dropTable(req.params.table))
      res.json({ ok: true })
    } catch (error) {
      sendSourceError(res, error, 'The table could not be dropped')
    }
  })

  app.post('/api/projects/:projectId/sources/:sourceId/tables/:table/save', async (req, res) => {
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const payload = req.body as Omit<SQLSaveTableChangesInput, 'table'>

    try {
      res.json(
        await withSqlAdapter(source, async (adapter) =>
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
    const source = await requireSource(context, req.params.projectId, req.params.sourceId, res)
    if (!source) return

    const { query } = req.body as { query?: string }
    if (!query?.trim()) {
      res.status(400).json({ error: 'Query is required' })
      return
    }

    try {
      const results = await withSqlAdapter(source, async (adapter) => adapter.executeStatements(query))
      res.json({ results })
    } catch (error) {
      sendSourceError(res, error, 'The SQL query could not be executed')
    }
  })
}
