import { buildAlterTableStatements } from '@/datasources/shared-sql/schema/alter'
import type { DataSourceType, SQLTableColumn } from '@/types/sql'
import type {
  TableCheckDraft,
  TableColumnDraft,
  TableForeignKeyDraft,
  TableIndexDraft,
  TableKeyDraft,
  TableSchemaDraft,
  TableSchemaSnapshot,
  TableTriggerDraft,
  TableVirtualColumnDraft,
} from '@/types/table-schema'
import { quoteIdentifier } from '@/datasources/shared-sql/query'

function parseColumns(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeName(value: string) {
  return value.trim()
}

function tableRef(tableName: string, sourceType: DataSourceType) {
  return quoteIdentifier(tableName, sourceType)
}

function columnList(value: string, sourceType: DataSourceType) {
  const columns = parseColumns(value)
  if (!columns.length) {
    throw new Error('At least one column is required')
  }

  return columns.map((column) => quoteIdentifier(column, sourceType)).join(', ')
}

function buildColumnDefinition(sourceType: DataSourceType, column: TableColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Column ${column.name} requires a SQL type`)
  }

  if (sourceType === 'sqlite' && column.autoIncrement && column.primaryKey) {
    return `${quoteIdentifier(column.name, sourceType)} INTEGER PRIMARY KEY AUTOINCREMENT`
  }

  if (sourceType === 'postgres' && column.autoIncrement) {
    const serialType = /big/i.test(column.type) ? 'BIGSERIAL' : 'SERIAL'
    return `${quoteIdentifier(column.name, sourceType)} ${serialType}${column.nullable ? '' : ' NOT NULL'}`
  }

  const parts = [quoteIdentifier(column.name, sourceType), column.type.trim()]
  parts.push(column.nullable ? 'NULL' : 'NOT NULL')

  if (column.defaultValue.trim()) {
    parts.push(`DEFAULT ${column.defaultValue.trim()}`)
  }

  if (sourceType === 'mysql' && column.autoIncrement) {
    parts.push('AUTO_INCREMENT')
  }

  return parts.join(' ')
}

function buildVirtualColumnDefinition(sourceType: DataSourceType, column: TableVirtualColumnDraft) {
  if (!normalizeName(column.name)) {
    throw new Error('Virtual columns require a name')
  }

  if (!column.type.trim()) {
    throw new Error(`Virtual column ${column.name} requires a SQL type`)
  }

  if (!column.expression.trim()) {
    throw new Error(`Virtual column ${column.name} requires an expression`)
  }

  const storage = sourceType === 'postgres' ? 'STORED' : column.storage.toUpperCase()

  return [
    quoteIdentifier(column.name, sourceType),
    column.type.trim(),
    `GENERATED ALWAYS AS (${column.expression.trim()}) ${storage}`,
  ].join(' ')
}

function buildKeyDefinition(sourceType: DataSourceType, key: TableKeyDraft) {
  const constraintName = normalizeName(key.name)
  const kind = key.type === 'primary' ? 'PRIMARY KEY' : 'UNIQUE'
  const columns = columnList(key.columns, sourceType)

  if (key.type === 'primary' && sourceType === 'mysql') {
    return `PRIMARY KEY (${columns})`
  }

  if (!constraintName) {
    throw new Error(`${kind} entries require a name`)
  }

  return `CONSTRAINT ${quoteIdentifier(constraintName, sourceType)} ${kind} (${columns})`
}

function buildForeignKeyDefinition(sourceType: DataSourceType, foreignKey: TableForeignKeyDraft) {
  const name = normalizeName(foreignKey.name)
  if (!name) {
    throw new Error('Foreign keys require a name')
  }

  if (!foreignKey.referencedTable.trim()) {
    throw new Error(`Foreign key ${foreignKey.name} requires a referenced table`)
  }

  const parts = [
    `CONSTRAINT ${quoteIdentifier(name, sourceType)}`,
    `FOREIGN KEY (${columnList(foreignKey.columns, sourceType)})`,
    `REFERENCES ${quoteIdentifier(foreignKey.referencedTable.trim(), sourceType)} (${columnList(
      foreignKey.referencedColumns,
      sourceType,
    )})`,
  ]

  if (foreignKey.onDelete.trim()) {
    parts.push(`ON DELETE ${foreignKey.onDelete.trim()}`)
  }

  if (foreignKey.onUpdate.trim()) {
    parts.push(`ON UPDATE ${foreignKey.onUpdate.trim()}`)
  }

  return parts.join(' ')
}

function buildCheckDefinition(sourceType: DataSourceType, check: TableCheckDraft) {
  const name = normalizeName(check.name)
  if (!name) {
    throw new Error('Checks require a name')
  }

  if (!check.expression.trim()) {
    throw new Error(`Check ${check.name} requires an expression`)
  }

  return `CONSTRAINT ${quoteIdentifier(name, sourceType)} CHECK (${check.expression.trim()})`
}

function buildIndexStatement(sourceType: DataSourceType, tableName: string, index: TableIndexDraft) {
  const name = normalizeName(index.name)
  if (!name) {
    throw new Error('Indexes require a name')
  }

  const method =
    index.method.trim() && sourceType !== 'sqlite'
      ? sourceType === 'mysql'
        ? ` USING ${index.method.trim()}`
        : ` USING ${index.method.trim()}`
      : ''

  if (sourceType === 'postgres') {
    return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdentifier(name, sourceType)} ON ${tableRef(tableName, sourceType)}${method} (${columnList(index.columns, sourceType)})`
  }

  return `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${quoteIdentifier(name, sourceType)} ON ${tableRef(tableName, sourceType)} (${columnList(index.columns, sourceType)})${method}`
}

function normalizeTriggerSql(trigger: TableTriggerDraft) {
  const sql = trigger.sql.trim().replace(/;+\s*$/g, '')
  if (!normalizeName(trigger.name) || !sql) {
    throw new Error('Triggers require a name and SQL definition')
  }

  return sql
}

function virtualColumnToSqlColumn(column: TableVirtualColumnDraft): SQLTableColumn {
  return {
    name: column.name,
    field: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: undefined,
    autoIncrement: false,
    primaryKey: false,
  }
}

function draftColumnToSqlColumn(column: TableColumnDraft): SQLTableColumn {
  return {
    name: column.name,
    field: column.name,
    type: column.type,
    nullable: column.nullable,
    defaultValue: column.defaultValue || undefined,
    autoIncrement: column.autoIncrement,
    primaryKey: column.primaryKey,
  }
}

function toAlterColumnDraft(column: TableColumnDraft) {
  return {
    originalName: column.originalName,
    name: column.name,
    type: column.type,
    nullable: column.nullable,
    primaryKey: column.primaryKey,
    autoIncrement: column.autoIncrement,
    defaultValue: column.defaultValue,
  }
}

function compareByName<T extends { name: string; originalName?: string }>(items: T[]) {
  return new Map(items.map((item) => [normalizeName(item.originalName || item.name), item]))
}

function compareSignature<T>(value: T) {
  return JSON.stringify(value)
}

function buildDropKeyStatement(sourceType: DataSourceType, tableName: string, key: TableKeyDraft) {
  const name = normalizeName(key.originalName || key.name)
  if (key.type === 'primary') {
    if (sourceType === 'mysql') {
      return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP PRIMARY KEY`
    }

    return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP CONSTRAINT ${quoteIdentifier(name, sourceType)}`
  }

  if (sourceType === 'mysql') {
    return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP INDEX ${quoteIdentifier(name, sourceType)}`
  }

  return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP CONSTRAINT ${quoteIdentifier(name, sourceType)}`
}

function buildAddKeyStatement(sourceType: DataSourceType, tableName: string, key: TableKeyDraft) {
  const definition = buildKeyDefinition(sourceType, key)
  return `ALTER TABLE ${tableRef(tableName, sourceType)} ADD ${definition}`
}

function buildDropForeignKeyStatement(sourceType: DataSourceType, tableName: string, key: TableForeignKeyDraft) {
  const name = normalizeName(key.originalName || key.name)
  if (sourceType === 'mysql') {
    return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP FOREIGN KEY ${quoteIdentifier(name, sourceType)}`
  }

  return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP CONSTRAINT ${quoteIdentifier(name, sourceType)}`
}

function buildAddForeignKeyStatement(sourceType: DataSourceType, tableName: string, key: TableForeignKeyDraft) {
  return `ALTER TABLE ${tableRef(tableName, sourceType)} ADD ${buildForeignKeyDefinition(sourceType, key)}`
}

function buildDropCheckStatement(sourceType: DataSourceType, tableName: string, check: TableCheckDraft) {
  const name = normalizeName(check.originalName || check.name)
  if (sourceType === 'mysql') {
    return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP CHECK ${quoteIdentifier(name, sourceType)}`
  }

  return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP CONSTRAINT ${quoteIdentifier(name, sourceType)}`
}

function buildAddCheckStatement(sourceType: DataSourceType, tableName: string, check: TableCheckDraft) {
  return `ALTER TABLE ${tableRef(tableName, sourceType)} ADD ${buildCheckDefinition(sourceType, check)}`
}

function buildDropIndexStatement(sourceType: DataSourceType, tableName: string, index: TableIndexDraft) {
  const name = normalizeName(index.originalName || index.name)
  if (sourceType === 'mysql') {
    return `DROP INDEX ${quoteIdentifier(name, sourceType)} ON ${tableRef(tableName, sourceType)}`
  }

  return `DROP INDEX ${quoteIdentifier(name, sourceType)}`
}

function buildAddVirtualColumnStatement(sourceType: DataSourceType, tableName: string, column: TableVirtualColumnDraft) {
  return `ALTER TABLE ${tableRef(tableName, sourceType)} ADD COLUMN ${buildVirtualColumnDefinition(sourceType, column)}`
}

function buildDropVirtualColumnStatement(sourceType: DataSourceType, tableName: string, column: TableVirtualColumnDraft) {
  const name = normalizeName(column.originalName || column.name)
  return `ALTER TABLE ${tableRef(tableName, sourceType)} DROP COLUMN ${quoteIdentifier(name, sourceType)}`
}

function buildDropTriggerStatement(sourceType: DataSourceType, tableName: string, trigger: TableTriggerDraft) {
  const name = normalizeName(trigger.originalName || trigger.name)
  if (sourceType === 'postgres') {
    return `DROP TRIGGER IF EXISTS ${quoteIdentifier(name, sourceType)} ON ${tableRef(tableName, sourceType)}`
  }

  return `DROP TRIGGER IF EXISTS ${quoteIdentifier(name, sourceType)}`
}

function diffNamedItems<T extends { name: string; originalName?: string }>(input: {
  previous: T[]
  next: T[]
  compare: (value: T) => string
}) {
  const previousByName = compareByName(input.previous)
  const nextByName = compareByName(input.next)

  const removed = input.previous.filter((item) => !nextByName.has(normalizeName(item.originalName || item.name)))
  const added = input.next.filter((item) => !previousByName.has(normalizeName(item.originalName || item.name)))
  const changed = input.next.filter((item) => {
    const key = normalizeName(item.originalName || item.name)
    const previousItem = previousByName.get(key)
    return previousItem ? input.compare(previousItem) !== input.compare(item) : false
  })

  return { removed, added, changed }
}

export function buildCreateTableStatements(sourceType: DataSourceType, schema: TableSchemaDraft) {
  const tableName = normalizeName(schema.name)
  if (!tableName) {
    throw new Error('Table name is required')
  }

  const definitions = [
    ...schema.columns.map((column) => buildColumnDefinition(sourceType, column)),
    ...schema.virtualColumns.map((column) => buildVirtualColumnDefinition(sourceType, column)),
    ...schema.keys.map((key) => buildKeyDefinition(sourceType, key)),
    ...schema.foreignKeys.map((foreignKey) => buildForeignKeyDefinition(sourceType, foreignKey)),
    ...schema.checks.map((check) => buildCheckDefinition(sourceType, check)),
  ]

  if (!definitions.length) {
    throw new Error('At least one column is required')
  }

  const statements = [`CREATE TABLE ${tableRef(tableName, sourceType)} (\n  ${definitions.join(',\n  ')}\n)`]
  statements.push(...schema.indexes.map((index) => buildIndexStatement(sourceType, tableName, index)))
  statements.push(...schema.triggers.map((trigger) => normalizeTriggerSql(trigger)))

  return statements
}

export function buildEditTableStatements(input: {
  sourceType: DataSourceType
  tableName: string
  original: TableSchemaSnapshot
  next: TableSchemaDraft
}) {
  const statements: string[] = []
  const tableName = normalizeName(input.tableName)

  const previousVirtualColumns = input.original.virtualColumns
  const nextVirtualColumns = input.next.virtualColumns
  const virtualColumnDiff = diffNamedItems({
    previous: previousVirtualColumns,
    next: nextVirtualColumns,
    compare: (value) =>
      compareSignature({
        name: value.name,
        type: value.type,
        expression: value.expression,
        storage: value.storage,
        nullable: value.nullable,
      }),
  })

  const keyDiff = diffNamedItems({
    previous: input.original.keys,
    next: input.next.keys,
    compare: (value) =>
      compareSignature({
        name: value.name,
        type: value.type,
        columns: parseColumns(value.columns),
      }),
  })
  const foreignKeyDiff = diffNamedItems({
    previous: input.original.foreignKeys,
    next: input.next.foreignKeys,
    compare: (value) =>
      compareSignature({
        name: value.name,
        columns: parseColumns(value.columns),
        referencedTable: value.referencedTable,
        referencedColumns: parseColumns(value.referencedColumns),
        onDelete: value.onDelete,
        onUpdate: value.onUpdate,
      }),
  })
  const checkDiff = diffNamedItems({
    previous: input.original.checks,
    next: input.next.checks,
    compare: (value) =>
      compareSignature({
        name: value.name,
        expression: value.expression.trim(),
      }),
  })
  const indexDiff = diffNamedItems({
    previous: input.original.indexes,
    next: input.next.indexes,
    compare: (value) =>
      compareSignature({
        name: value.name,
        columns: parseColumns(value.columns),
        unique: value.unique,
        method: value.method.trim().toLowerCase(),
      }),
  })
  const triggerDiff = diffNamedItems({
    previous: input.original.triggers,
    next: input.next.triggers,
    compare: (value) =>
      compareSignature({
        name: value.name,
        sql: value.sql.trim(),
      }),
  })

  if (input.sourceType !== 'sqlite') {
    for (const item of [...triggerDiff.removed, ...triggerDiff.changed]) {
      statements.push(buildDropTriggerStatement(input.sourceType, tableName, item))
    }

    for (const item of [...foreignKeyDiff.removed, ...foreignKeyDiff.changed]) {
      statements.push(buildDropForeignKeyStatement(input.sourceType, tableName, item))
    }

    for (const item of [...checkDiff.removed, ...checkDiff.changed]) {
      statements.push(buildDropCheckStatement(input.sourceType, tableName, item))
    }

    for (const item of [...keyDiff.removed, ...keyDiff.changed]) {
      statements.push(buildDropKeyStatement(input.sourceType, tableName, item))
    }
  }

  for (const item of [...indexDiff.removed, ...indexDiff.changed]) {
    statements.push(buildDropIndexStatement(input.sourceType, tableName, item))
  }

  for (const item of [...virtualColumnDiff.removed, ...virtualColumnDiff.changed]) {
    statements.push(buildDropVirtualColumnStatement(input.sourceType, tableName, item))
  }

  statements.push(
    ...buildAlterTableStatements({
      sourceType: input.sourceType,
      tableName,
      originalColumns: input.original.columns.map((column) => draftColumnToSqlColumn(column)),
      nextColumns: input.next.columns.map((column) => toAlterColumnDraft(column)),
    }),
  )

  for (const item of [...virtualColumnDiff.added, ...virtualColumnDiff.changed]) {
    statements.push(buildAddVirtualColumnStatement(input.sourceType, tableName, item))
  }

  if (input.sourceType !== 'sqlite') {
    for (const item of [...keyDiff.added, ...keyDiff.changed]) {
      statements.push(buildAddKeyStatement(input.sourceType, tableName, item))
    }

    for (const item of [...foreignKeyDiff.added, ...foreignKeyDiff.changed]) {
      statements.push(buildAddForeignKeyStatement(input.sourceType, tableName, item))
    }

    for (const item of [...checkDiff.added, ...checkDiff.changed]) {
      statements.push(buildAddCheckStatement(input.sourceType, tableName, item))
    }
  }

  for (const item of [...indexDiff.added, ...indexDiff.changed]) {
    statements.push(buildIndexStatement(input.sourceType, tableName, item))
  }

  for (const item of [...triggerDiff.added, ...triggerDiff.changed]) {
    statements.push(normalizeTriggerSql(item))
  }

  return statements.filter(Boolean)
}
