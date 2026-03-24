import type { AxiosInstance } from 'axios'
import type { ElasticsearchSearchResult } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

export const DEFAULT_ELASTICSEARCH_QUERY = JSON.stringify(
  {
    from: 0,
    size: 10,
    track_total_hits: true,
    query: {
      match_all: {},
    },
  },
  null,
  2,
)

const ELASTICSEARCH_META_FIELDS = new Set(['_id', '_index', '_score'])

function createRowId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  if (value instanceof Date) {
    return new Date(value) as T
  }

  if (typeof value === 'object') {
    return JSON.parse(JSON.stringify(value)) as T
  }

  return value
}

function serializeNestedValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value) || isRecord(value)) {
    return JSON.stringify(value)
  }

  return value
}

function registerFieldType(fieldTypes: Map<string, string>, fieldName: string, value: unknown) {
  if (value === null || value === undefined) {
    return
  }

  const nextType =
    Array.isArray(value) || isRecord(value)
      ? 'json'
      : typeof value === 'number'
        ? 'number'
        : typeof value === 'boolean'
          ? 'boolean'
          : 'text'

  const currentType = fieldTypes.get(fieldName)
  if (!currentType) {
    fieldTypes.set(fieldName, nextType)
    return
  }

  if (currentType !== nextType) {
    fieldTypes.set(fieldName, 'text')
  }
}

function flattenDocument(
  value: Record<string, unknown>,
  fieldTypes: Map<string, string>,
  prefix = '',
): Record<string, unknown> {
  const entries = Object.entries(value)
  const nextValue: Record<string, unknown> = {}

  for (const [key, entryValue] of entries) {
    const fieldName = prefix ? `${prefix}.${key}` : key

    if (isRecord(entryValue)) {
      const nested = flattenDocument(entryValue, fieldTypes, fieldName)
      if (Object.keys(nested).length) {
        Object.assign(nextValue, nested)
      } else {
        registerFieldType(fieldTypes, fieldName, entryValue)
        nextValue[fieldName] = '{}'
      }
      continue
    }

    registerFieldType(fieldTypes, fieldName, entryValue)
    nextValue[fieldName] = serializeNestedValue(entryValue)
  }

  return nextValue
}

function inferColumnType(fieldTypes: Map<string, string>, columnName: string, values: unknown[]) {
  if (ELASTICSEARCH_META_FIELDS.has(columnName)) {
    if (columnName === '_score') {
      return 'number'
    }

    return 'text'
  }

  const fieldType = fieldTypes.get(columnName)
  if (fieldType) {
    return fieldType
  }

  const nonNullValues = values.filter((value) => value !== null && value !== undefined)
  if (!nonNullValues.length) {
    return 'text'
  }

  if (nonNullValues.every((value) => typeof value === 'number')) {
    return 'number'
  }

  if (nonNullValues.every((value) => typeof value === 'boolean')) {
    return 'boolean'
  }

  return 'text'
}

function normalizeDocumentValue(column: SQLTableColumn, value: unknown) {
  if (value === undefined) {
    return null
  }

  if (column.type === 'number') {
    const numericValue = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(numericValue) ? numericValue : value
  }

  if (column.type === 'boolean') {
    if (typeof value === 'boolean') {
      return value
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['true', '1', 'yes'].includes(normalized)) {
        return true
      }

      if (['false', '0', 'no'].includes(normalized)) {
        return false
      }
    }
  }

  if (column.type === 'json') {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return null
      }

      return JSON.parse(trimmed)
    }
  }

  return value
}

function assignNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.').filter(Boolean)
  if (!segments.length) {
    return
  }

  let current = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!
    if (!isRecord(current[key])) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[segments[segments.length - 1]!] = value
}

export function extractElasticsearchIndexFromPath(path?: string) {
  const normalizedPath = path?.trim().replace(/^\/+|\/+$/g, '') ?? ''
  if (!normalizedPath) {
    return ''
  }

  const [index] = normalizedPath.split('/').filter(Boolean)
  return index ?? ''
}

export function parseElasticsearchQuery(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return {}
  }

  const parsed = JSON.parse(trimmed)
  if (!isRecord(parsed)) {
    throw new Error('The Elasticsearch request body must be a JSON object.')
  }

  return parsed
}

export function formatElasticsearchQuery(value: string) {
  return JSON.stringify(parseElasticsearchQuery(value), null, 2)
}

export function applyElasticsearchRequestControls(
  body: Record<string, unknown>,
  options: {
    from: number
    size: number
    trackTotalHits: boolean
  },
) {
  return {
    ...body,
    from: options.from,
    size: options.size,
    track_total_hits: options.trackTotalHits,
  }
}

export async function runElasticsearchSearch(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  index: string
  body: Record<string, unknown>
  from?: number
  size?: number
  trackTotalHits?: boolean
}) {
  const response = await input.client.post(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/elasticsearch/search`,
    {
      index: input.index,
      body: input.body,
      from: input.from ?? 0,
      size: input.size ?? 100,
      trackTotalHits: input.trackTotalHits ?? true,
    },
  )

  return response.data as ElasticsearchSearchResult
}

export async function saveElasticsearchDocuments(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  index: string
  columns: SQLTableColumn[]
  rows: SQLTableRowDraft[]
}) {
  const mutations = buildElasticsearchMutationPayload(input.columns, input.rows)
  const response = await input.client.post(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/elasticsearch/save`,
    {
      index: input.index,
      ...mutations,
    },
  )

  return response.data as {
    tookMs: number | null
    inserted: number
    updated: number
    deleted: number
  }
}

export function buildElasticsearchResultTable(result: ElasticsearchSearchResult) {
  const fieldTypes = new Map<string, string>()
  const normalizedRows: Array<Record<string, unknown>> = result.hits.map((hit) => ({
    _id: hit.id,
    _index: hit.index,
    _score: hit.score,
    ...flattenDocument(hit.source, fieldTypes),
  }))

  const columnNames = Array.from(
    normalizedRows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        set.add(key)
      }

      return set
    }, new Set<string>(['_id', '_index', '_score'])),
  )

  const columns: SQLTableColumn[] = columnNames.map((columnName) => ({
    name: columnName,
    field: columnName,
    type: inferColumnType(
      fieldTypes,
      columnName,
      normalizedRows.map((row) => row[columnName]),
    ),
    readOnly: ELASTICSEARCH_META_FIELDS.has(columnName),
  }))

  const rows: SQLTableRowDraft[] = normalizedRows.map((row) => ({
    id: createRowId(),
    values: cloneValue(row),
    original: cloneValue(row),
    state: 'clean',
  }))

  return {
    columns,
    rows,
  }
}

export function buildElasticsearchDocument(columns: SQLTableColumn[], rowValues: Record<string, unknown>) {
  const document: Record<string, unknown> = {}

  for (const column of columns) {
    if (ELASTICSEARCH_META_FIELDS.has(column.field)) {
      continue
    }

    assignNestedValue(document, column.field, normalizeDocumentValue(column, rowValues[column.field]))
  }

  return document
}

export function buildElasticsearchMutationPayload(columns: SQLTableColumn[], rows: SQLTableRowDraft[]) {
  const inserted = rows
    .filter((row) => row.state === 'new')
    .map((row) => buildElasticsearchDocument(columns, row.values))

  const updated = rows
    .filter((row) => row.state === 'modified' && row.original?._id)
    .map((row) => ({
      id: String(row.original?._id),
      document: buildElasticsearchDocument(columns, row.values),
    }))

  const deleted = rows
    .filter((row) => row.state === 'deleted' && row.original?._id)
    .map((row) => String(row.original?._id))

  return {
    inserted,
    updated,
    deleted,
  }
}
