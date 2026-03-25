import { MariaSQL } from '@codemirror/lang-sql'
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

export const clickHouseSqlDialect = defineSqlDialect({
  type: 'clickhouse',
  editorDialect: MariaSQL,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `\`${identifier.replace(/`/g, '``')}\``
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
  getDefaultSchemaName(source) {
    return getTrimmedString(source.config.database) ?? source.name
  },
  getTableSchemaSupport(mode) {
    const createSections: TableSchemaSectionId[] = ['columns']
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
          ? 'Create a simple ClickHouse table from columns only. StarQuery uses MergeTree with ORDER BY tuple() by default so you can get started quickly.'
          : 'Edit existing ClickHouse tables column-by-column. More advanced engine and index settings are still best done through SQL for now.',
      indexMethodPlaceholder: 'Optional',
      virtualColumnStorageLocked: true,
    }
  },
})
