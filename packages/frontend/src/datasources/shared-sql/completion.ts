import type { SQLNamespace } from '@codemirror/lang-sql'
import type { AxiosInstance } from 'axios'
import type { SQLTableDetails } from '@/types/sql'
import type { DataSourceRecord } from '@/types/workspace'
import { getDefaultSqlSchemaName } from '@/datasources/shared-sql/dialect'

export type SQLCompletionCatalog = {
  schema?: SQLNamespace
  defaultSchema?: string
  defaultTable?: string
}

type CompletionSourceRecord = Pick<DataSourceRecord, 'type' | 'config' | 'name'>

function getColumnLabels(table: SQLTableDetails) {
  return table.columns.map((column) => column.name)
}

export function buildSqlCompletionCatalog(input: {
  source: CompletionSourceRecord
  tables: SQLTableDetails[]
  defaultTable?: string
}): SQLCompletionCatalog {
  if (!input.tables.length) {
    return {
      defaultSchema: getDefaultSqlSchemaName(input.source),
      defaultTable: input.defaultTable,
    }
  }

  const defaultSchema = getDefaultSqlSchemaName(input.source)
  const tableNamespace = Object.fromEntries(
    input.tables.map((table) => [table.name, getColumnLabels(table)]),
  )

  return {
    schema: {
      [defaultSchema]: tableNamespace,
    },
    defaultSchema,
    defaultTable: input.defaultTable,
  }
}

export async function loadSqlCompletionCatalog(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  source: CompletionSourceRecord
  defaultTable?: string
}): Promise<SQLCompletionCatalog> {
  const tables = (
    await input.client.get(`/api/projects/${input.projectId}/sources/${input.sourceId}/tables`)
  ).data as Array<{ name: string }>

  if (!tables.length) {
    return buildSqlCompletionCatalog({
      source: input.source,
      tables: [],
      defaultTable: input.defaultTable,
    })
  }

  const details = await Promise.all(
    tables.map(async (table) =>
      (
        await input.client.get(`/api/projects/${input.projectId}/sources/${input.sourceId}/tables/${table.name}`)
      ).data as SQLTableDetails,
    ),
  )

  return buildSqlCompletionCatalog({
    source: input.source,
    tables: details,
    defaultTable: input.defaultTable,
  })
}
