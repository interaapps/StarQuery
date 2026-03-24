import type { AxiosInstance } from 'axios'
import type { SQLExecutionResult, SQLTableDetails } from '@/types/sql'
import type { DataSourceRecord } from '@/types/workspace'
import { getSqlTableSchemaDialect } from '@/datasources/shared-sql/schema/dialect'
import { parseColumnList } from '@/datasources/shared-sql/schema/utils'
import {
  cloneTableSchema,
  createCheckDraft,
  createDefaultTableSchema,
  createForeignKeyDraft,
  createIndexDraft,
  createKeyDraft,
  createTriggerDraft,
  createVirtualColumnDraft,
  createVirtualForeignKeyDraft,
  normalizeSqlColumnToDraft,
  type TableSchemaState,
  type TableVirtualForeignKeyDraft,
  type VirtualForeignKeyConfig,
} from '@/types/table-schema'

function cloneJsonRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T
}

async function runQuery(
  client: AxiosInstance,
  projectId: string,
  sourceId: string,
  query: string,
) {
  const response = await client.post(`/api/projects/${projectId}/sources/${sourceId}/query`, { query })
  return (response.data.results ?? []) as SQLExecutionResult[]
}

function getSelectRows(result: SQLExecutionResult | undefined) {
  if (!result || result.type !== 'SELECT') {
    return []
  }

  return result.rows
}

function parseKeyDrafts(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    createKeyDraft({
      originalName: String(row.name),
      name: String(row.name),
      type: String(row.constraint_type).toUpperCase().includes('PRIMARY') ? 'primary' : 'unique',
      columns: parseColumnList(row.column_names).join(', '),
    }),
  )
}

function parseForeignKeyDrafts(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    createForeignKeyDraft({
      originalName: String(row.name),
      name: String(row.name),
      columns: parseColumnList(row.column_names).join(', '),
      referencedTable: String(row.referenced_table ?? ''),
      referencedColumns: parseColumnList(row.referenced_column_names).join(', '),
      onDelete: String(row.delete_rule ?? 'NO ACTION'),
      onUpdate: String(row.update_rule ?? 'NO ACTION'),
    }),
  )
}

function parseIndexDrafts(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    createIndexDraft({
      originalName: String(row.name),
      name: String(row.name),
      columns: parseColumnList(row.column_names).join(', '),
      unique: Boolean(row.is_unique),
      method: String(row.index_method ?? ''),
    }),
  )
}

function parseCheckDrafts(rows: Record<string, unknown>[], sourceType: DataSourceRecord['type']) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return rows.map((row) =>
    createCheckDraft({
      originalName: String(row.name),
      name: String(row.name),
      expression: dialect.parseCheckExpression(row),
    }),
  )
}

function parseTriggerDrafts(
  rows: Record<string, unknown>[],
  sourceType: DataSourceRecord['type'],
  tableName: string,
) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return rows.map((row) =>
    createTriggerDraft({
      originalName: String(row.name),
      name: String(row.name),
      sql: dialect.buildTriggerSql(tableName, row),
    }),
  )
}

function parseVirtualColumnDrafts(
  rows: Record<string, unknown>[],
  sourceType: DataSourceRecord['type'],
) {
  const dialect = getSqlTableSchemaDialect(sourceType)
  return rows.map((row) =>
    createVirtualColumnDraft({
      originalName: String(row.name),
      name: String(row.name),
      type: String(row.column_type ?? 'VARCHAR(255)'),
      expression: String(row.generation_expression ?? ''),
      storage: dialect.getVirtualColumnStorage(row),
      nullable: String(row.is_nullable ?? 'YES') === 'YES',
    }),
  )
}

function parseVirtualForeignKeyDrafts(source: DataSourceRecord, tableName: string) {
  const config = (source.config ?? {}) as { virtualForeignKeys?: Record<string, VirtualForeignKeyConfig[]> }
  const entries = config.virtualForeignKeys?.[tableName] ?? []

  return entries.map((entry) =>
    createVirtualForeignKeyDraft({
      name: entry.name,
      columns: entry.columns.join(', '),
      referencedTable: entry.referencedTable,
      referencedColumns: entry.referencedColumns.join(', '),
      displayColumns: entry.displayColumns?.join(', ') ?? '',
    }),
  )
}

export async function loadTableSchemaState(input: {
  client: AxiosInstance
  projectId: string
  source: DataSourceRecord
  tableName: string
}): Promise<TableSchemaState> {
  const detailsResponse = await input.client.get(
    `/api/projects/${input.projectId}/sources/${input.source.id}/tables/${input.tableName}`,
  )
  const details = detailsResponse.data as SQLTableDetails
  const dialect = getSqlTableSchemaDialect(input.source.type)
  const metadataResults = await runQuery(
    input.client,
    input.projectId,
    input.source.id,
    dialect.buildMetadataQuery({
      tableName: input.tableName,
      source: input.source,
    }),
  )

  const isSqlite = dialect.type === 'sqlite'
  const virtualColumnDrafts = isSqlite
    ? []
    : parseVirtualColumnDrafts(getSelectRows(metadataResults[5]), input.source.type)
  const virtualColumnNames = new Set(virtualColumnDrafts.map((column) => column.name))

  const schema = createDefaultTableSchema()
  schema.name = input.tableName
  schema.columns = details.columns
    .filter((column) => !virtualColumnNames.has(column.name))
    .map((column) => normalizeSqlColumnToDraft(column))
  schema.keys = isSqlite ? [] : parseKeyDrafts(getSelectRows(metadataResults[0]))
  schema.foreignKeys = isSqlite ? [] : parseForeignKeyDrafts(getSelectRows(metadataResults[1]))
  schema.indexes = isSqlite
    ? getSelectRows(metadataResults[0])
        .filter((row) => String(row.origin ?? '') === 'c' && row.name)
        .map((row) =>
          createIndexDraft({
            originalName: String(row.name),
            name: String(row.name),
            columns: '',
            unique: Boolean(row.unique),
            method: '',
          }),
        )
    : parseIndexDrafts(getSelectRows(metadataResults[2]))
  schema.checks = isSqlite ? [] : parseCheckDrafts(getSelectRows(metadataResults[3]), input.source.type)
  schema.triggers = isSqlite
    ? parseTriggerDrafts(getSelectRows(metadataResults[1]), input.source.type, input.tableName)
    : parseTriggerDrafts(getSelectRows(metadataResults[4]), input.source.type, input.tableName)
  schema.virtualColumns = virtualColumnDrafts
  schema.virtualForeignKeys = parseVirtualForeignKeyDrafts(input.source, input.tableName)

  const original = cloneTableSchema(schema)
  return { schema, original }
}

export function createEmptyTableSchemaState() {
  const schema = createDefaultTableSchema()
  return {
    schema,
    original: null,
  }
}

export function serializeVirtualForeignKeys(
  source: DataSourceRecord,
  tableName: string,
  entries: TableVirtualForeignKeyDraft[],
) {
  const config = cloneJsonRecord(source.config ?? {}) as {
    virtualForeignKeys?: Record<string, VirtualForeignKeyConfig[]>
  }
  const record = config.virtualForeignKeys ? { ...config.virtualForeignKeys } : {}

  const serializedEntries = entries
    .filter((entry) => entry.name.trim() && entry.columns.trim() && entry.referencedTable.trim() && entry.referencedColumns.trim())
    .map((entry) => ({
      name: entry.name.trim(),
      columns: parseColumnList(entry.columns),
      referencedTable: entry.referencedTable.trim(),
      referencedColumns: parseColumnList(entry.referencedColumns),
      displayColumns: parseColumnList(entry.displayColumns),
    }))

  if (tableName.trim()) {
    if (serializedEntries.length) {
      record[tableName] = serializedEntries
    } else {
      delete record[tableName]
    }
  }

  if (Object.keys(record).length) {
    config.virtualForeignKeys = record
  } else {
    delete config.virtualForeignKeys
  }

  return config
}
