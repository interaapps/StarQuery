import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'
import { registerResourceSourceRoutes } from './sources/resource-routes.ts'
import { registerSourceCrudRoutes } from './sources/crud-routes.ts'
import { registerElasticsearchSourceRoutes } from './sources/elasticsearch-routes.ts'
import { registerObjectStorageSourceRoutes } from './sources/object-storage-routes.ts'
import { registerSqlSourceRoutes } from './sources/sql-routes.ts'

export function registerSourceRoutes(app: Express, context: AppContext) {
  registerSourceCrudRoutes(app, context)
  registerSqlSourceRoutes(app, context)
  registerElasticsearchSourceRoutes(app, context)
  registerObjectStorageSourceRoutes(app, context)
  registerResourceSourceRoutes(app, context)
}
