import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import type { ConvexQueryResponse } from '@/types/convex'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

function buildRecordTable(input: {
  title: string
  kind: string
  fileBaseName: string
  rows: Record<string, unknown>[]
}): GenericQueryResultTable {
  const columns = Array.from(new Set(input.rows.flatMap((row) => Object.keys(row))))

  return {
    title: input.title,
    kind: input.kind,
    columns,
    rows: input.rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, serializeValue(row[column])])),
    ),
    exportFileBaseName: input.fileBaseName,
  }
}

function buildFieldValueTable(input: {
  title: string
  kind: string
  fileBaseName: string
  value: Record<string, unknown>
}): GenericQueryResultTable {
  return {
    title: input.title,
    kind: input.kind,
    columns: ['field', 'value'],
    rows: Object.entries(input.value).map(([field, value]) => ({
      field,
      value: serializeValue(value),
    })),
    exportFileBaseName: input.fileBaseName,
  }
}

export function summarizeConvexValue(value: unknown) {
  if (value === null || value === undefined) {
    return 'No value returned.'
  }

  if (Array.isArray(value)) {
    return `${value.length} entr${value.length === 1 ? 'y' : 'ies'} returned.`
  }

  if (isRecord(value)) {
    return `${Object.keys(value).length} field(s) returned.`
  }

  return String(value)
}

export function buildConvexQueryResultTables(
  response: ConvexQueryResponse,
  sourceName: string,
): GenericQueryResultTable[] {
  const baseTitle = `${response.functionType} • ${response.path}`
  const fileBaseName = `${sourceName}-${response.functionType}-${response.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'result'}`
  const value = response.value

  if (Array.isArray(value)) {
    if (value.every((entry) => isRecord(entry))) {
      return [
        buildRecordTable({
          title: baseTitle,
          kind: response.functionType,
          fileBaseName,
          rows: value,
        }),
      ]
    }

    return [
      {
        title: baseTitle,
        kind: response.functionType,
        columns: ['index', 'value'],
        rows: value.map((entry, index) => ({
          index,
          value: serializeValue(entry),
        })),
        exportFileBaseName: fileBaseName,
      },
    ]
  }

  if (isRecord(value)) {
    const nestedTables = Object.entries(value).flatMap(([key, entryValue]) => {
      if (Array.isArray(entryValue) && entryValue.every((item) => isRecord(item))) {
        return [
          buildRecordTable({
            title: `${baseTitle} • ${key}`,
            kind: response.functionType,
            fileBaseName: `${fileBaseName}-${key}`,
            rows: entryValue,
          }),
        ]
      }

      if (Array.isArray(entryValue)) {
        return [
          {
            title: `${baseTitle} • ${key}`,
            kind: response.functionType,
            columns: ['index', 'value'],
            rows: entryValue.map((item, index) => ({
              index,
              value: serializeValue(item),
            })),
            exportFileBaseName: `${fileBaseName}-${key}`,
          } satisfies GenericQueryResultTable,
        ]
      }

      return []
    })

    return [
      buildFieldValueTable({
        title: baseTitle,
        kind: response.functionType,
        fileBaseName,
        value,
      }),
      ...nestedTables,
    ]
  }

  return [
    {
      title: baseTitle,
      kind: response.functionType,
      columns: ['value'],
      rows: [{ value: serializeValue(value) }],
      exportFileBaseName: fileBaseName,
    },
  ]
}
