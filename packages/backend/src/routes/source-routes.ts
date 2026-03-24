import type { Express } from 'express'
import type { AppContext } from '../app-context.ts'
import { registerElasticsearchSourceRoutes } from '../datasources/elasticsearch/routes.ts'
import { registerObjectStorageSourceRoutes } from '../datasources/shared-object-storage/routes.ts'
import { registerResourceSourceRoutes } from '../datasources/shared-resource/routes.ts'
import { registerSqlSourceRoutes } from '../datasources/shared-sql/routes.ts'
import { registerSourceCrudRoutes } from './sources/crud-routes.ts'

export function registerSourceRoutes(app: Express, context: AppContext) {
  registerSourceCrudRoutes(app, context)
  registerSqlSourceRoutes(app, context)
  registerElasticsearchSourceRoutes(app, context)
  registerObjectStorageSourceRoutes(app, context)
  registerResourceSourceRoutes(app, context)
}
