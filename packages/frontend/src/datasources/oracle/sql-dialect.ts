import { PostgreSQL } from '@codemirror/lang-sql'
import {
  createDefaultTableSchema,
  TABLE_SCHEMA_SECTIONS,
  type TableSchemaSectionId,
} from '@/types/table-schema'
import {
  assertSqlIdentifier,
  defineSqlDialect,
  getTrimmedString,
} from '@/datasources/shared-sql/dialect-types'
import { normalizeOrderByClause, normalizeWhereClause } from '@/datasources/shared-sql/fragments'

export const oracleSqlDialect = defineSqlDialect({
  type: 'oracle',
  editorDialect: PostgreSQL,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  },
  buildTableQuery(input) {
    const page = Math.max(1, Math.floor(input.page))
    const pageSize = Math.floor(input.pageSize)
    const offset = (page - 1) * pageSize
    const tableName = this.quoteIdentifier(input.tableName)
    const whereClause = normalizeWhereClause(input.whereClause)
    const orderByClause = normalizeOrderByClause(input.orderByClause) ?? input.fallbackOrderByClause
    const whereSql = whereClause ? ` WHERE ${whereClause}` : ''

    return [
      `SELECT COUNT(*) AS starquery_total FROM ${tableName}${whereSql}`,
      `SELECT * FROM ${tableName}${whereSql} ORDER BY ${orderByClause} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`,
    ].join(';\n')
  },
  getDefaultSchemaName(source) {
    return getTrimmedString(source.config.user) ?? source.name
  },
  getTableSchemaSupport(mode) {
    const createSections: TableSchemaSectionId[] = ['columns', 'keys', 'foreignKeys', 'indexes', 'checks']
    const editSections: TableSchemaSectionId[] = ['columns']
    return {
      sections: mode === 'create' ? createSections : TABLE_SCHEMA_SECTIONS.map((section) => section.id),
      editableSections: mode === 'create' ? createSections : editSections,
    }
  },
  createDefaultTableSchema() {
    return createDefaultTableSchema()
  },
  getTableSchemaUi(mode) {
    return {
      editDescription:
        mode === 'create'
          ? 'Create a new Oracle table with columns, keys, foreign keys, checks, and indexes. Editing existing Oracle tables in the schema designer is still disabled for now.'
          : 'Edit existing Oracle tables column-by-column. More advanced constraint editing is still best done through SQL for now.',
      indexMethodPlaceholder: 'Optional',
      virtualColumnStorageLocked: true,
    }
  },
})
