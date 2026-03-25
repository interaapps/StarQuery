import { SQLite } from '@codemirror/lang-sql'
import {
  createDefaultTableSchema,
  TABLE_SCHEMA_SECTIONS,
  type TableSchemaSectionId,
} from '@/types/table-schema'
import { defineSqlDialect, assertSqlIdentifier } from '@/datasources/shared-sql/dialect-types'
import { normalizeOrderByClause, normalizeWhereClause } from '@/datasources/shared-sql/fragments'

export const sqliteSqlDialect = defineSqlDialect({
  type: 'sqlite',
  editorDialect: SQLite,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `"${identifier.replace(/"/g, '""')}"`
  },
  getDefaultSchemaName() {
    return 'main'
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
  getTableSchemaSupport(mode) {
    const sections = TABLE_SCHEMA_SECTIONS.map((section) => section.id)
    const editSections: TableSchemaSectionId[] = ['columns', 'indexes', 'triggers', 'virtualForeignKeys']

    return {
      sections: mode === 'create' ? sections : editSections,
      editableSections: mode === 'create' ? sections : editSections,
    }
  },
  createDefaultTableSchema() {
    const schema = createDefaultTableSchema()
    schema.keys = []
    return schema
  },
  getTableSchemaUi(mode) {
    return {
      editDescription:
        mode === 'edit'
          ? 'SQLite editing is currently focused on columns, indexes, triggers, and virtual foreign keys. More complex constraint editing is still best done through SQL for existing SQLite tables.'
          : 'Edit the schema on the right. The SQL preview below is generated from these entries and executed as normal SQL against the datasource.',
      indexMethodPlaceholder: 'Optional',
      virtualColumnStorageLocked: false,
    }
  },
})
