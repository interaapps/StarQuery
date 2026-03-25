import { sqliteSqlDialect } from '@/datasources/sqlite/sql-dialect'
import { defineSqlDialect } from '@/datasources/shared-sql/dialect-types'
import type { TableSchemaSectionId } from '@/types/table-schema'

export const duckDbSqlDialect = defineSqlDialect({
  ...sqliteSqlDialect,
  type: 'duckdb',
  getTableSchemaSupport(mode) {
    const sections: TableSchemaSectionId[] = ['columns']
    return {
      sections,
      editableSections: sections,
    }
  },
  getTableSchemaUi(mode) {
    return {
      editDescription:
        mode === 'create'
          ? 'Create a DuckDB table column-by-column. More advanced constraints are still best done through SQL for now.'
          : 'Edit existing DuckDB tables column-by-column. More advanced constraints are still best done through SQL for now.',
      indexMethodPlaceholder: 'Optional',
      virtualColumnStorageLocked: false,
    }
  },
})
