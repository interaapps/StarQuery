import { SQLite } from '@codemirror/lang-sql'
import {
  createDefaultTableSchema,
  TABLE_SCHEMA_SECTIONS,
  type TableSchemaSectionId,
} from '@/types/table-schema'
import { defineSqlDialect, assertSqlIdentifier } from '@/datasources/shared-sql/dialect-types'

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
