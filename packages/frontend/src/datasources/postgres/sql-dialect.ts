import { PostgreSQL } from '@codemirror/lang-sql'
import { createDefaultTableSchema, TABLE_SCHEMA_SECTIONS } from '@/types/table-schema'
import { defineSqlDialect, getTrimmedString, assertSqlIdentifier } from '@/datasources/shared-sql/dialect-types'

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
