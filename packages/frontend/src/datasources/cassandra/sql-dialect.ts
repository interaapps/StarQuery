import { PostgreSQL } from '@codemirror/lang-sql'
import { createDefaultTableSchema, TABLE_SCHEMA_SECTIONS } from '@/types/table-schema'
import {
  assertSqlIdentifier,
  defineSqlDialect,
  getTrimmedString,
} from '@/datasources/shared-sql/dialect-types'
import { normalizeWhereClause } from '@/datasources/shared-sql/fragments'

export const cassandraSqlDialect = defineSqlDialect({
  type: 'cassandra',
  editorDialect: PostgreSQL,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  },
  buildTableQuery(input) {
    const pageSize = Math.floor(input.pageSize)
    const tableName = this.quoteIdentifier(input.tableName)
    const whereClause = normalizeWhereClause(input.whereClause)
    const whereSql = whereClause ? ` WHERE ${whereClause}` : ''

    return [
      `SELECT COUNT(*) AS starquery_total FROM ${tableName}${whereSql}`,
      `SELECT * FROM ${tableName}${whereSql} LIMIT ${pageSize}`,
    ].join(';\n')
  },
  getDefaultSchemaName(source) {
    return getTrimmedString(source.config.database) ?? source.name
  },
  getTableSchemaSupport() {
    return {
      sections: TABLE_SCHEMA_SECTIONS.map((section) => section.id),
      editableSections: [],
    }
  },
  createDefaultTableSchema() {
    return createDefaultTableSchema()
  },
  getTableSchemaUi() {
    return {
      editDescription: 'Schema editing is not available for this datasource yet.',
      indexMethodPlaceholder: 'Optional',
      virtualColumnStorageLocked: true,
    }
  },
})
