import type { AxiosInstance } from 'axios'
import type { MongoDbQueryResult } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const MONGO_ROW_DOCUMENT_FIELD = '__mongoDocument'
const MONGO_ROW_ID_FIELD = '__mongoId'

export const DEFAULT_MONGODB_FILTER = `{
}`

export const DEFAULT_MONGODB_SORT = `{
  "_id": -1
}`

export const DEFAULT_MONGODB_PROJECTION = `{
}`

function createRowId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mongo-row-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function valuesEqual(left: unknown, right: unknown) {
  if (left === right) {
    return true
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

function serializePreviewValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value) || isRecord(value)) {
    return JSON.stringify(value)
  }

  return value
}

function toOverviewRow(
  value: Record<string, unknown>,
  fieldTypes: Map<string, string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      registerFieldType(fieldTypes, key, entryValue)
      return [key, serializePreviewValue(entryValue)]
    }),
  )
}

function registerFieldType(fieldTypes: Map<string, string>, fieldName: string, value: unknown) {
  if (value === null || value === undefined) {
    return
  }

  const nextType =
    typeof value === 'number'
      ? 'number'
      : typeof value === 'boolean'
        ? 'boolean'
        : Array.isArray(value) || isRecord(value)
          ? 'json'
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

function inferColumnType(fieldTypes: Map<string, string>, fieldName: string, values: unknown[]) {
  const fieldType = fieldTypes.get(fieldName)
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

function normalizeMongoCellValue(column: SQLTableColumn, value: unknown) {
  if (value === undefined) {
    return null
  }

  if (column.type === 'number') {
    if (value === null || value === '') {
      return null
    }

    const nextValue = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(nextValue) ? nextValue : value
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
    if (value === null || value === '') {
      return null
    }

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

function buildOverviewValues(columns: SQLTableColumn[], document: Record<string, unknown>) {
  return Object.fromEntries(
    columns.map((column) => [column.field, serializePreviewValue(document[column.field])]),
  )
}

export function buildMongoDocumentFromRow(
  row: SQLTableRowDraft | null | undefined,
  columns: SQLTableColumn[],
) {
  if (!row) {
    return null
  }

  const baseDocument = isRecord(row.values[MONGO_ROW_DOCUMENT_FIELD])
    ? cloneValue(row.values[MONGO_ROW_DOCUMENT_FIELD] as Record<string, unknown>)
    : {}

  for (const column of columns) {
    const nextValue = normalizeMongoCellValue(column, row.values[column.field])

    if (column.field === '_id' && (nextValue === null || nextValue === undefined || nextValue === '')) {
      delete baseDocument._id
      continue
    }

    if (nextValue === undefined) {
      delete baseDocument[column.field]
      continue
    }

    baseDocument[column.field] = nextValue
  }

  return baseDocument
}

function deriveMongoDocumentId(document: Record<string, unknown>) {
  return document._id === undefined ? null : cloneValue(document._id)
}

export function createMongoDraftRow(
  columns: SQLTableColumn[],
  document?: Record<string, unknown> | null,
) {
  const normalizedDocument = document ? cloneValue(document) : {}
  const overviewValues = buildOverviewValues(columns, normalizedDocument)

  return {
    id: createRowId(),
    values: {
      ...overviewValues,
      [MONGO_ROW_DOCUMENT_FIELD]: normalizedDocument,
      [MONGO_ROW_ID_FIELD]: deriveMongoDocumentId(normalizedDocument),
    },
    original: null,
    state: 'new' as const,
  }
}

export function applyMongoDocumentToRow(
  row: SQLTableRowDraft,
  columns: SQLTableColumn[],
  document: Record<string, unknown>,
) {
  const nextDocument = cloneValue(document)
  const overviewValues = buildOverviewValues(columns, nextDocument)

  row.values = {
    ...row.values,
    ...overviewValues,
    [MONGO_ROW_DOCUMENT_FIELD]: nextDocument,
    [MONGO_ROW_ID_FIELD]: deriveMongoDocumentId(nextDocument),
  }

  if (!row.original) {
    row.state = 'new'
    return
  }

  const isDirty = columns.some((column) => !valuesEqual(row.values[column.field], row.original?.[column.field]))
  row.state = isDirty ? 'modified' : 'clean'
}

export function buildMongoMutationPayload(columns: SQLTableColumn[], rows: SQLTableRowDraft[]) {
  const inserted = rows
    .filter((row) => row.state === 'new')
    .map((row) => buildMongoDocumentFromRow(row, columns))
    .filter((row): row is Record<string, unknown> => row !== null)

  const updated = rows.flatMap((row) => {
    if (row.state !== 'modified' || !row.original) {
      return []
    }

    const id = getMongoDocumentIdFromRow({
      ...row,
      values: row.original ?? row.values,
    })
    const document = buildMongoDocumentFromRow(row, columns)

    if (id === null || document === null) {
      return []
    }

    return [{ id, document }]
  })

  const deleted = rows.flatMap((row) => {
    if (row.state !== 'deleted' || !row.original) {
      return []
    }

    const id = getMongoDocumentIdFromRow({
      ...row,
      values: row.original ?? row.values,
    })

    return id === null ? [] : [id]
  })

  return {
    inserted,
    updated,
    deleted,
  }
}

export function parseMongoPath(path?: string) {
  const normalizedPath = path?.trim().replace(/^\/+|\/+$/g, '') ?? ''
  if (!normalizedPath) {
    return {
      database: '',
      collection: '',
      documentToken: '',
    }
  }

  const segments = normalizedPath.split('/').filter(Boolean)
  return {
    database: segments[0] ?? '',
    collection: segments[1] ?? '',
    documentToken: segments[2] === '_doc' ? decodeURIComponent(segments.slice(3).join('/')) : '',
  }
}

export function parseMongoEditorObject(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return {}
  }

  const parsed = JSON.parse(trimmed)
  if (!isRecord(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }

  return parsed
}

export async function runMongoDbQuery(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
  filter?: Record<string, unknown>
  sort?: Record<string, unknown>
  projection?: Record<string, unknown>
  skip?: number
  limit?: number
}) {
  const response = await input.client.post(`/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/query`, {
    database: input.database,
    collection: input.collection,
    filter: input.filter ?? {},
    sort: input.sort ?? {},
    projection: input.projection ?? {},
    skip: input.skip ?? 0,
    limit: input.limit ?? 25,
  })

  return response.data as MongoDbQueryResult
}

export async function createMongoDbCollection(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
}) {
  const response = await input.client.post(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/collections`,
    {
      database: input.database,
      collection: input.collection,
    },
  )

  return response.data as {
    database: string
    collection: string
  }
}

export async function deleteMongoDbCollection(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
}) {
  const response = await input.client.delete(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/collections`,
    {
      data: {
        database: input.database,
        collection: input.collection,
      },
    },
  )

  return response.data as {
    database: string
    collection: string
    dropped: boolean
  }
}

export async function insertMongoDbDocument(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
  document: Record<string, unknown>
}) {
  const response = await input.client.post(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/document`,
    {
      database: input.database,
      collection: input.collection,
      document: input.document,
    },
  )

  return response.data as {
    insertedId: unknown
    document: MongoDbQueryResult['documents'][number]
  }
}

export async function replaceMongoDbDocument(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
  id: unknown
  document: Record<string, unknown>
}) {
  const response = await input.client.put(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/document`,
    {
      database: input.database,
      collection: input.collection,
      id: input.id,
      document: input.document,
    },
  )

  return response.data as {
    matchedCount: number
    modifiedCount: number
    document: MongoDbQueryResult['documents'][number]
  }
}

export async function deleteMongoDbDocuments(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  database: string
  collection: string
  ids: unknown[]
}) {
  const response = await input.client.delete(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/mongodb/documents`,
    {
      data: {
        database: input.database,
        collection: input.collection,
        ids: input.ids,
      },
    },
  )

  return response.data as {
    deletedCount: number
  }
}

export function buildMongoDbResultTable(result: MongoDbQueryResult) {
  const fieldTypes = new Map<string, string>()
  const normalizedRows: Array<Record<string, unknown>> = result.documents.map((entry) => ({
    ...toOverviewRow(entry.document, fieldTypes),
    [MONGO_ROW_DOCUMENT_FIELD]: cloneValue(entry.document),
    [MONGO_ROW_ID_FIELD]: cloneValue(entry.idValue),
  }))

  const columnNames = Array.from(
    normalizedRows.reduce((set, row) => {
      for (const key of Object.keys(row)) {
        if (key.startsWith('__mongo')) {
          continue
        }

        set.add(key)
      }

      return set
    }, new Set<string>()),
  )

  const columns: SQLTableColumn[] = columnNames.map((columnName) => ({
    name: columnName,
    field: columnName,
    type: inferColumnType(
      fieldTypes,
      columnName,
      normalizedRows.map((row) => row[columnName]),
    ),
    readOnly: columnName === '_id',
    autoIncrement: columnName === '_id',
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

export function getMongoDocumentFromRow(row: SQLTableRowDraft | null | undefined) {
  const value = row?.values?.[MONGO_ROW_DOCUMENT_FIELD]
  return isRecord(value) ? cloneValue(value) : null
}

export function getMongoDocumentIdFromRow(row: SQLTableRowDraft | null | undefined) {
  const value = row?.values?.[MONGO_ROW_ID_FIELD]
  return value === undefined ? null : cloneValue(value)
}
