import type { SQLEditTableColumnDraft } from '@/types/sql'
import type {
  TableCheckDraft,
  TableColumnDraft,
  TableForeignKeyDraft,
  TableIndexDraft,
  TableKeyDraft,
  TableTriggerDraft,
  TableVirtualColumnDraft,
} from '@/types/table-schema'
import { quoteSqlIdentifier } from '@/datasources/shared-sql/dialect'
import { defineSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect-types'
import {
  columnList,
  normalizeDefaultValue,
  normalizeName,
  tableRef,
} from '@/datasources/shared-sql/schema/utils'

function unsupportedEdit(operation: string): never {
  throw new Error(`Microsoft SQL Server schema editing does not support ${operation} in this editor yet.`)
}

function emptySelect(columns: string[]) {
  return `SELECT ${columns.join(', ')} WHERE 1 = 0`
}

function buildMssqlColumnDefinition(column: TableColumnDraft | SQLEditTableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  const parts = [quoteSqlIdentifier(column.name, 'mssql'), column.type.trim()]
  if (column.autoIncrement) {
    parts.push('IDENTITY(1,1)')
  }

  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  const defaultValue = normalizeDefaultValue(column.defaultValue)
  if (defaultValue) {
    parts.push(`DEFAULT ${defaultValue}`)
  }

  return parts.join(' ')
}

function buildConstraintName(name: string) {
  const normalized = normalizeName(name)
  if (!normalized) {
    throw new Error('A valid constraint name is required')
  }

  return quoteSqlIdentifier(normalized, 'mssql')
}

export const mssqlTableSchemaDialect = defineSqlTableSchemaDialect({
  type: 'mssql',
  buildMetadataQuery() {
    return [
      emptySelect([
        'CAST(NULL AS NVARCHAR(128)) AS name',
        'CAST(NULL AS NVARCHAR(32)) AS constraint_type',
        'CAST(NULL AS NVARCHAR(MAX)) AS column_names',
      ]),
      emptySelect([
        'CAST(NULL AS NVARCHAR(128)) AS name',
        'CAST(NULL AS NVARCHAR(MAX)) AS column_names',
        'CAST(NULL AS NVARCHAR(128)) AS referenced_table',
        'CAST(NULL AS NVARCHAR(MAX)) AS referenced_column_names',
        'CAST(NULL AS NVARCHAR(32)) AS delete_rule',
        'CAST(NULL AS NVARCHAR(32)) AS update_rule',
      ]),
      emptySelect([
        'CAST(NULL AS NVARCHAR(128)) AS name',
        'CAST(0 AS BIT) AS is_unique',
        'CAST(NULL AS NVARCHAR(32)) AS index_method',
        'CAST(NULL AS NVARCHAR(MAX)) AS column_names',
      ]),
      emptySelect(['CAST(NULL AS NVARCHAR(128)) AS name', 'CAST(NULL AS NVARCHAR(MAX)) AS expression']),
      emptySelect([
        'CAST(NULL AS NVARCHAR(128)) AS name',
        'CAST(NULL AS NVARCHAR(32)) AS timing',
        'CAST(NULL AS NVARCHAR(32)) AS event_name',
        'CAST(NULL AS NVARCHAR(MAX)) AS action_statement',
      ]),
      emptySelect([
        'CAST(NULL AS NVARCHAR(128)) AS name',
        'CAST(NULL AS NVARCHAR(128)) AS column_type',
        'CAST(NULL AS NVARCHAR(3)) AS is_nullable',
        'CAST(NULL AS NVARCHAR(MAX)) AS generation_expression',
      ]),
    ].join(';\n')
  },
  buildTriggerSql() {
    unsupportedEdit('creating triggers')
  },
  parseCheckExpression(row) {
    return String(row.definition ?? row.expression ?? '')
  },
  getVirtualColumnStorage() {
    return 'stored'
  },
  buildColumnDefinition(column) {
    return buildMssqlColumnDefinition(column)
  },
  buildVirtualColumnDefinition() {
    unsupportedEdit('virtual columns')
  },
  buildKeyDefinition(key: TableKeyDraft) {
    const columns = columnList(key.columns, 'mssql')
    if (key.type === 'primary') {
      return `CONSTRAINT ${buildConstraintName(key.name)} PRIMARY KEY (${columns})`
    }

    return `CONSTRAINT ${buildConstraintName(key.name)} UNIQUE (${columns})`
  },
  buildForeignKeyDefinition(foreignKey: TableForeignKeyDraft) {
    if (!foreignKey.referencedTable.trim()) {
      throw new Error(`Foreign key ${foreignKey.name} requires a referenced table`)
    }

    const parts = [
      `CONSTRAINT ${buildConstraintName(foreignKey.name)}`,
      `FOREIGN KEY (${columnList(foreignKey.columns, 'mssql')})`,
      `REFERENCES ${quoteSqlIdentifier(foreignKey.referencedTable.trim(), 'mssql')} (${columnList(foreignKey.referencedColumns, 'mssql')})`,
    ]

    if (foreignKey.onDelete.trim()) {
      parts.push(`ON DELETE ${foreignKey.onDelete.trim()}`)
    }

    if (foreignKey.onUpdate.trim()) {
      parts.push(`ON UPDATE ${foreignKey.onUpdate.trim()}`)
    }

    return parts.join(' ')
  },
  buildCheckDefinition(check: TableCheckDraft) {
    if (!check.expression.trim()) {
      throw new Error(`Check ${check.name} requires an expression`)
    }

    return `CONSTRAINT ${buildConstraintName(check.name)} CHECK (${check.expression.trim()})`
  },
  buildIndexStatement(tableName, index: TableIndexDraft) {
    const indexName = normalizeName(index.name)
    if (!indexName) {
      throw new Error('Indexes require a name')
    }

    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteSqlIdentifier(indexName, 'mssql')} ON ${tableRef(tableName, 'mssql')} (${columnList(index.columns, 'mssql')})`
  },
  buildDropKeyStatement() {
    unsupportedEdit('dropping keys')
  },
  buildDropForeignKeyStatement() {
    unsupportedEdit('dropping foreign keys')
  },
  buildDropCheckStatement() {
    unsupportedEdit('dropping checks')
  },
  buildDropIndexStatement() {
    unsupportedEdit('dropping indexes')
  },
  buildDropVirtualColumnStatement() {
    unsupportedEdit('dropping virtual columns')
  },
  buildDropTriggerStatement() {
    unsupportedEdit('dropping triggers')
  },
  buildAlterTableStatements({ tableName, originalColumns, nextColumns }) {
    const quotedTableName = tableRef(tableName, 'mssql')
    const originalByName = new Map(originalColumns.map((column) => [column.name, column]))
    const keptOriginalNames = new Set(
      nextColumns.map((column) => column.originalName).filter((value): value is string => Boolean(value)),
    )

    const statements: string[] = []

    for (const original of originalColumns) {
      if (!keptOriginalNames.has(original.name)) {
        statements.push(`ALTER TABLE ${quotedTableName} DROP COLUMN ${quoteSqlIdentifier(original.name, 'mssql')}`)
      }
    }

    for (const column of nextColumns) {
      if (!column.originalName) {
        statements.push(`ALTER TABLE ${quotedTableName} ADD ${buildMssqlColumnDefinition(column)}`)
        continue
      }

      const original = originalByName.get(column.originalName)
      if (!original) {
        continue
      }

      const unchanged =
        original.name === column.name &&
        (original.type || '').trim() === column.type.trim() &&
        Boolean(original.nullable) === column.nullable &&
        normalizeDefaultValue(original.defaultValue) === normalizeDefaultValue(column.defaultValue)

      if (unchanged) {
        continue
      }

      const currentName = quoteSqlIdentifier(original.name, 'mssql')
      const nextName = quoteSqlIdentifier(column.name, 'mssql')
      const targetName = original.name !== column.name ? nextName : currentName

      if (original.name !== column.name) {
        statements.push(`EXEC sp_rename '${tableName}.${original.name}', '${column.name}', 'COLUMN'`)
      }

      if (normalizeDefaultValue(original.defaultValue) !== normalizeDefaultValue(column.defaultValue)) {
        statements.push(
          `DECLARE @constraintName NVARCHAR(128); SELECT @constraintName = dc.name FROM sys.default_constraints dc INNER JOIN sys.columns c ON c.default_object_id = dc.object_id INNER JOIN sys.tables t ON t.object_id = c.object_id WHERE t.name = '${tableName}' AND c.name = '${column.name}'; IF @constraintName IS NOT NULL EXEC('ALTER TABLE ${quotedTableName} DROP CONSTRAINT [' + @constraintName + ']')`,
        )

        const nextDefault = normalizeDefaultValue(column.defaultValue)
        if (nextDefault) {
          const generatedConstraintName = normalizeName(`df_${tableName}_${column.name}`) ?? `DF_${tableName}_${column.name}`
          statements.push(
            `ALTER TABLE ${quotedTableName} ADD CONSTRAINT ${quoteSqlIdentifier(generatedConstraintName, 'mssql')} DEFAULT ${nextDefault} FOR ${targetName}`,
          )
        }
      }

      if ((original.type || '').trim() !== column.type.trim() || Boolean(original.nullable) !== column.nullable) {
        statements.push(
          `ALTER TABLE ${quotedTableName} ALTER COLUMN ${targetName} ${column.type.trim()} ${column.nullable ? 'NULL' : 'NOT NULL'}`,
        )
      }
    }

    return statements
  },
})
