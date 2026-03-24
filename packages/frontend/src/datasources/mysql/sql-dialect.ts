import { MariaSQL } from '@codemirror/lang-sql'
import { createDefaultTableSchema, TABLE_SCHEMA_SECTIONS } from '@/types/table-schema'
import { defineSqlDialect, getTrimmedString, assertSqlIdentifier } from '@/datasources/shared-sql/dialect-types'

export const mysqlSqlDialect = defineSqlDialect({
  type: 'mysql',
  editorDialect: MariaSQL,
  quoteIdentifier(identifier: string) {
    assertSqlIdentifier(identifier)
    return `\`${identifier.replace(/`/g, '``')}\``
  },
  getDefaultSchemaName(source) {
    return getTrimmedString(source.config.database) ?? source.name
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
      indexMethodPlaceholder: 'BTREE',
      virtualColumnStorageLocked: false,
    }
  },
})
