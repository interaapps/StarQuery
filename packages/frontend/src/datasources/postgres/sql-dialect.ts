import { PostgreSQL } from '@codemirror/lang-sql'
import { createDefaultTableSchema, TABLE_SCHEMA_SECTIONS } from '@/types/table-schema'
import { defineSqlDialect, getTrimmedString, assertSqlIdentifier } from '@/datasources/shared-sql/dialect-types'
import { normalizeOrderByClause, normalizeWhereClause } from '@/datasources/shared-sql/fragments'

export const postgresSqlDialect = defineSqlDialect({
  type: 'postgres',
  editorDialect: PostgreSQL,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  },
  getDefaultSchemaName(source) {
    return getTrimmedString(source.config.schema) ?? getTrimmedString(source.config.database) ?? source.name
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
      `SELECT * FROM ${tableName}${whereSql} ORDER BY ${orderByClause} LIMIT ${pageSize} OFFSET ${offset}`,
    ].join(';\n')
  },
  getTableSchemaSupport() {
    const sections = TABLE_SCHEMA_SECTIONS.map((section) => section.id)
    return {
      sections,
      editableSections: sections,
    }
  },
  createDefaultTableSchema() {
    return createDefaultTableSchema()
  },
  getTableSchemaUi() {
    return {
      editDescription:
        'Edit the schema on the right. The SQL preview below is generated from these entries and executed as normal SQL against the datasource.',
      indexMethodPlaceholder: 'btree',
      virtualColumnStorageLocked: true,
    }
  },
})
