import type { AxiosInstance } from 'axios'
import type { SQLExecutionResult, SQLTableDetails } from '@/types/sql'
import type { DataSourceRecord } from '@/types/workspace'
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
  type TableCheckDraft,
  type TableForeignKeyDraft,
  type TableIndexDraft,
  type TableKeyDraft,
  type TableSchemaState,
  type TableTriggerDraft,
  type TableVirtualColumnDraft,
  type TableVirtualForeignKeyDraft,
  type VirtualForeignKeyConfig,
} from '@/types/table-schema'
import { quoteIdentifier } from '@/datasources/shared-sql/query'

function parseColumnList(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function cloneJsonRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T
}

function escapeLiteral(value: string) {
  return value.replace(/'/g, "''")
}

function unwrapPostgresCheckDefinition(definition: string) {
  const match = definition.match(/^CHECK\s*\((.*)\)$/is)
  return match ? match[1] : definition
}

function buildTriggerSql(source: DataSourceRecord['type'], tableName: string, row: Record<string, unknown>) {
  if (source === 'mysql') {
    return `CREATE TRIGGER ${quoteIdentifier(String(row.name), source)} ${String(row.timing)} ${String(row.event_name)} ON ${quoteIdentifier(tableName, source)} FOR EACH ROW ${String(row.action_statement).trim()}`
  }

  return String(row.definition ?? row.sql ?? '').trim()
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

function buildMysqlMetadataQuery(tableName: string) {
  const table = escapeLiteral(tableName)

  return [
    `
      SELECT
        tc.CONSTRAINT_NAME AS name,
        tc.CONSTRAINT_TYPE AS constraint_type,
        GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION SEPARATOR ',') AS column_names
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
       AND kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema = tc.table_schema
       AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = DATABASE()
        AND tc.table_name = '${table}'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE
      ORDER BY tc.CONSTRAINT_NAME
    `,
    `
      SELECT
        rc.CONSTRAINT_NAME AS name,
        GROUP_CONCAT(kcu.COLUMN_NAME ORDER BY kcu.ORDINAL_POSITION SEPARATOR ',') AS column_names,
        MAX(kcu.REFERENCED_TABLE_NAME) AS referenced_table,
        GROUP_CONCAT(kcu.REFERENCED_COLUMN_NAME ORDER BY kcu.POSITION_IN_UNIQUE_CONSTRAINT SEPARATOR ',') AS referenced_column_names,
        MAX(rc.DELETE_RULE) AS delete_rule,
        MAX(rc.UPDATE_RULE) AS update_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = rc.constraint_schema
       AND kcu.constraint_name = rc.constraint_name
       AND kcu.table_schema = rc.constraint_schema
      WHERE rc.constraint_schema = DATABASE()
        AND rc.table_name = '${table}'
      GROUP BY rc.CONSTRAINT_NAME
      ORDER BY rc.CONSTRAINT_NAME
    `,
    `
      SELECT
        s.INDEX_NAME AS name,
        s.NON_UNIQUE = 0 AS is_unique,
        s.INDEX_TYPE AS index_method,
        GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX SEPARATOR ',') AS column_names
      FROM information_schema.statistics s
      LEFT JOIN information_schema.table_constraints tc
        ON tc.constraint_schema = s.TABLE_SCHEMA
       AND tc.table_schema = s.TABLE_SCHEMA
       AND tc.table_name = s.TABLE_NAME
       AND tc.constraint_name = s.INDEX_NAME
       AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      WHERE s.TABLE_SCHEMA = DATABASE()
        AND s.TABLE_NAME = '${table}'
        AND s.INDEX_NAME <> 'PRIMARY'
        AND tc.constraint_name IS NULL
      GROUP BY s.INDEX_NAME, s.NON_UNIQUE, s.INDEX_TYPE
      ORDER BY s.INDEX_NAME
    `,
    `
      SELECT
        tc.CONSTRAINT_NAME AS name,
        cc.CHECK_CLAUSE AS expression
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON cc.constraint_schema = tc.constraint_schema
       AND cc.constraint_name = tc.constraint_name
      WHERE tc.table_schema = DATABASE()
        AND tc.table_name = '${table}'
        AND tc.constraint_type = 'CHECK'
      ORDER BY tc.CONSTRAINT_NAME
    `,
    `
      SELECT
        TRIGGER_NAME AS name,
        ACTION_TIMING AS timing,
        EVENT_MANIPULATION AS event_name,
        ACTION_STATEMENT AS action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
        AND EVENT_OBJECT_TABLE = '${table}'
      ORDER BY TRIGGER_NAME
    `,
    `
      SELECT
        COLUMN_NAME AS name,
        COLUMN_TYPE AS column_type,
        IS_NULLABLE AS is_nullable,
        GENERATION_EXPRESSION AS generation_expression,
        EXTRA AS extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = '${table}'
        AND EXTRA LIKE '%GENERATED%'
      ORDER BY ORDINAL_POSITION
    `,
  ].join(';\n')
}

function buildPostgresMetadataQuery(tableName: string, schema: string) {
  const table = escapeLiteral(tableName)
  const safeSchema = escapeLiteral(schema)

  return [
    `
      SELECT
        con.conname AS name,
        CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' ELSE 'UNIQUE' END AS constraint_type,
        string_agg(att.attname, ',' ORDER BY ord.ordinality) AS column_names
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY ord(attnum, ordinality) ON true
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ord.attnum
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype IN ('p', 'u')
      GROUP BY con.conname, con.contype
      ORDER BY con.conname
    `,
    `
      SELECT
        con.conname AS name,
        string_agg(src.attname, ',' ORDER BY src_ord.ordinality) AS column_names,
        confrel.relname AS referenced_table,
        string_agg(dst.attname, ',' ORDER BY src_ord.ordinality) AS referenced_column_names,
        CASE con.confdeltype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS delete_rule,
        CASE con.confupdtype
          WHEN 'a' THEN 'NO ACTION'
          WHEN 'r' THEN 'RESTRICT'
          WHEN 'c' THEN 'CASCADE'
          WHEN 'n' THEN 'SET NULL'
          WHEN 'd' THEN 'SET DEFAULT'
        END AS update_rule
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN pg_class confrel ON confrel.oid = con.confrelid
      JOIN unnest(con.conkey) WITH ORDINALITY src_ord(attnum, ordinality) ON true
      JOIN pg_attribute src ON src.attrelid = con.conrelid AND src.attnum = src_ord.attnum
      JOIN unnest(con.confkey) WITH ORDINALITY dst_ord(attnum, ordinality)
        ON dst_ord.ordinality = src_ord.ordinality
      JOIN pg_attribute dst ON dst.attrelid = con.confrelid AND dst.attnum = dst_ord.attnum
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype = 'f'
      GROUP BY con.conname, confrel.relname, con.confdeltype, con.confupdtype
      ORDER BY con.conname
    `,
    `
      SELECT
        idx.relname AS name,
        ind.indisunique AS is_unique,
        am.amname AS index_method,
        string_agg(att.attname, ',' ORDER BY key_ord.ordinality) AS column_names
      FROM pg_index ind
      JOIN pg_class tbl ON tbl.oid = ind.indrelid
      JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
      JOIN pg_class idx ON idx.oid = ind.indexrelid
      JOIN pg_am am ON am.oid = idx.relam
      JOIN unnest(ind.indkey) WITH ORDINALITY key_ord(attnum, ordinality) ON key_ord.attnum > 0
      JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key_ord.attnum
      LEFT JOIN pg_constraint con ON con.conindid = ind.indexrelid AND con.contype IN ('p', 'u')
      WHERE nsp.nspname = '${safeSchema}'
        AND tbl.relname = '${table}'
        AND con.oid IS NULL
      GROUP BY idx.relname, ind.indisunique, am.amname
      ORDER BY idx.relname
    `,
    `
      SELECT
        con.conname AS name,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND con.contype = 'c'
      ORDER BY con.conname
    `,
    `
      SELECT
        tg.tgname AS name,
        pg_get_triggerdef(tg.oid, true) AS definition
      FROM pg_trigger tg
      JOIN pg_class rel ON rel.oid = tg.tgrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = '${safeSchema}'
        AND rel.relname = '${table}'
        AND NOT tg.tgisinternal
      ORDER BY tg.tgname
    `,
    `
      SELECT
        column_name AS name,
        COALESCE(udt_name, data_type) AS column_type,
        is_nullable,
        generation_expression
      FROM information_schema.columns
      WHERE table_schema = '${safeSchema}'
        AND table_name = '${table}'
        AND is_generated = 'ALWAYS'
      ORDER BY ordinal_position
    `,
  ].join(';\n')
}

function buildSqliteMetadataQuery(tableName: string) {
  const quotedTable = quoteIdentifier(tableName, 'sqlite')
  const table = escapeLiteral(tableName)

  return [
    `PRAGMA index_list(${quotedTable})`,
    `
      SELECT
        name,
        sql
      FROM sqlite_master
      WHERE type = 'trigger'
        AND tbl_name = '${table}'
      ORDER BY name
    `,
  ].join(';\n')
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
  return rows.map((row) =>
    createCheckDraft({
      originalName: String(row.name),
      name: String(row.name),
      expression:
        sourceType === 'postgres'
          ? unwrapPostgresCheckDefinition(String(row.definition ?? ''))
          : String(row.expression ?? ''),
    }),
  )
}

function parseTriggerDrafts(
  rows: Record<string, unknown>[],
  sourceType: DataSourceRecord['type'],
  tableName: string,
) {
  return rows.map((row) =>
    createTriggerDraft({
      originalName: String(row.name),
      name: String(row.name),
      sql: buildTriggerSql(sourceType, tableName, row),
    }),
  )
}

function parseVirtualColumnDrafts(rows: Record<string, unknown>[], sourceType: DataSourceRecord['type']) {
  return rows.map((row) => {
    const extra = String(row.extra ?? '')
    const storage =
      sourceType === 'postgres'
        ? 'stored'
        : extra.toLowerCase().includes('stored')
          ? 'stored'
          : 'virtual'

    return createVirtualColumnDraft({
      originalName: String(row.name),
      name: String(row.name),
      type: String(row.column_type ?? 'VARCHAR(255)'),
      expression: String(row.generation_expression ?? ''),
      storage,
      nullable: String(row.is_nullable ?? 'YES') === 'YES',
    })
  })
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

  const metadataQuery =
    input.source.type === 'mysql'
      ? buildMysqlMetadataQuery(input.tableName)
      : input.source.type === 'postgres'
        ? buildPostgresMetadataQuery(input.tableName, String(input.source.config.schema ?? 'public'))
        : buildSqliteMetadataQuery(input.tableName)

  const metadataResults = await runQuery(input.client, input.projectId, input.source.id, metadataQuery)
  const virtualColumnDrafts =
    input.source.type === 'sqlite'
      ? []
      : parseVirtualColumnDrafts(getSelectRows(metadataResults[5]), input.source.type)
  const virtualColumnNames = new Set(virtualColumnDrafts.map((column) => column.name))

  const schema = createDefaultTableSchema()
  schema.name = input.tableName
  schema.columns = details.columns
    .filter((column) => !virtualColumnNames.has(column.name))
    .map((column) => normalizeSqlColumnToDraft(column))
  schema.keys = input.source.type === 'sqlite' ? [] : parseKeyDrafts(getSelectRows(metadataResults[0]))
  schema.foreignKeys = input.source.type === 'sqlite' ? [] : parseForeignKeyDrafts(getSelectRows(metadataResults[1]))
  schema.indexes =
    input.source.type === 'sqlite'
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
  schema.checks = input.source.type === 'sqlite' ? [] : parseCheckDrafts(getSelectRows(metadataResults[3]), input.source.type)
  schema.triggers =
    input.source.type === 'sqlite'
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
