import type { ResourceBrowserItem, ResourceBrowserListing } from '../types.ts'
import type { ResourceDataSourceAdapter, ResourceListOptions } from '../shared-resource/types.ts'

type ConvexFunctionType = 'query' | 'mutation' | 'action'

type ConvexConfig = {
  deploymentUrl: string
  adminKey?: string
  authToken?: string
}

type ConvexFunctionResponse = {
  status?: 'success' | 'error'
  value?: unknown
  logLines?: string[]
  errorMessage?: string
  errorData?: unknown
}

type ConvexSnapshotResponse = {
  values?: unknown[]
  hasMore?: boolean
  snapshot?: number
  cursor?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeDeploymentUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/g, '')
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed
}

function encodeCursor(value: { snapshot: number; cursor: string }) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeCursor(value: string | undefined) {
  if (!value?.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (
      isRecord(parsed) &&
      typeof parsed.cursor === 'string' &&
      typeof parsed.snapshot === 'number'
    ) {
      return {
        cursor: parsed.cursor,
        snapshot: parsed.snapshot,
      }
    }
  } catch {
    return null
  }

  return null
}

function matchesSearch(search: string | undefined, value: unknown) {
  if (!search?.trim()) {
    return true
  }

  const needle = search.trim().toLowerCase()
  return JSON.stringify(value ?? '')
    .toLowerCase()
    .includes(needle)
}

function toRecordList(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function toMetadataValue(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return JSON.stringify(value)
}

function extractTableSchemas(payload: unknown) {
  const tableRecord =
    isRecord(payload) && isRecord(payload.tables)
      ? payload.tables
      : isRecord(payload)
        ? payload
        : {}

  return Object.entries(tableRecord)
    .filter(([tableName]) => !tableName.startsWith('$'))
    .map(([tableName, schema]) => ({
      tableName,
      schema: isRecord(schema) ? schema : {},
      fieldNames: isRecord(schema) && isRecord(schema.properties) ? Object.keys(schema.properties) : [],
    }))
}

export class ConvexResourceAdapter implements ResourceDataSourceAdapter {
  private readonly deploymentUrl: string

  constructor(private readonly config: ConvexConfig) {
    this.deploymentUrl = normalizeDeploymentUrl(config.deploymentUrl)
  }

  async connect() {}

  async close() {}

  private buildUrl(path: string, query?: Record<string, string>) {
    const url = new URL(path, `${this.deploymentUrl}/`)

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value)
    }

    return url.toString()
  }

  private async requestJson<T>(
    path: string,
    init?: RequestInit,
    mode: 'admin' | 'function' = 'admin',
  ): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')

    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    if (mode === 'admin') {
      if (!this.config.adminKey?.trim()) {
        throw new Error('Convex browsing requires an admin key in the datasource config.')
      }

      headers.set('Authorization', `Convex ${this.config.adminKey.trim()}`)
    } else if (this.config.authToken?.trim()) {
      headers.set('Authorization', `Bearer ${this.config.authToken.trim()}`)
    }

    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers,
    })
    const text = await response.text()

    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = text
    }

    if (!response.ok) {
      throw new Error(
        (isRecord(payload) && typeof payload.errorMessage === 'string' && payload.errorMessage) ||
          (isRecord(payload) && typeof payload.error === 'string' && payload.error) ||
          (typeof payload === 'string' && payload) ||
          `Convex request failed with status ${response.status}`,
      )
    }

    return payload as T
  }

  private async loadSchemas() {
    const payload = await this.requestJson<unknown>('/api/json_schemas?format=json', undefined, 'admin')
    return extractTableSchemas(payload)
  }

  private async loadSnapshotPage(input: {
    tableName: string
    cursor?: string
    snapshot?: number
  }) {
    const query = new URLSearchParams({
      tableName: input.tableName,
      format: 'json',
    })

    if (input.cursor) {
      query.set('cursor', input.cursor)
    }

    if (typeof input.snapshot === 'number') {
      query.set('snapshot', String(input.snapshot))
    }

    const payload = await this.requestJson<ConvexSnapshotResponse>(
      `/api/list_snapshot?${query.toString()}`,
      undefined,
      'admin',
    )

    return {
      values: toRecordList(payload.values),
      hasMore: Boolean(payload.hasMore),
      snapshot: typeof payload.snapshot === 'number' ? payload.snapshot : 0,
      cursor: typeof payload.cursor === 'string' ? payload.cursor : '',
    }
  }

  async runFunction(input: {
    functionType: ConvexFunctionType
    path: string
    args: Record<string, unknown>
  }) {
    const payload = await this.requestJson<ConvexFunctionResponse>(
      `/api/${input.functionType}`,
      {
        method: 'POST',
        body: JSON.stringify({
          path: input.path,
          args: input.args,
          format: 'json',
        }),
      },
      'function',
    )

    if (payload.status === 'error') {
      throw new Error(payload.errorMessage || 'The Convex function returned an error.')
    }

    return {
      functionType: input.functionType,
      path: input.path,
      args: input.args,
      value: payload.value ?? null,
      logLines: Array.isArray(payload.logLines)
        ? payload.logLines.map((line) => String(line))
        : [],
    }
  }

  async list(path: string, options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')
    const segments = normalizedPath ? normalizedPath.split('/').filter(Boolean) : []
    const tableName = segments[0]
    const documentId = segments[1] === '_doc' ? decodeURIComponent(segments.slice(2).join('/')) : null

    if (!tableName) {
      return this.listTables(options)
    }

    if (documentId) {
      return this.getDocument(tableName, documentId)
    }

    return this.listDocuments(tableName, options)
  }

  private async listTables(options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const tables = (await this.loadSchemas()).filter((table) =>
      matchesSearch(options?.search, {
        name: table.tableName,
        fields: table.fieldNames,
      }),
    )

    const items: ResourceBrowserItem[] = tables.map((table) => ({
      id: table.tableName,
      name: table.tableName,
      kind: 'container',
      path: table.tableName,
      description: 'table',
      metadata: {
        fieldCount: table.fieldNames.length,
        ...(table.fieldNames.length ? { fields: table.fieldNames.join(', ') } : {}),
      },
    }))

    return {
      path: '',
      items,
      preview: {
        type: 'text',
        title: 'Convex Tables',
        text: `${items.length} table(s) loaded`,
      },
      details: {
        name: 'Tables',
        kind: 'container',
        path: '',
        metadata: {
          deploymentUrl: this.deploymentUrl,
        },
      },
    }
  }

  private async listDocuments(
    tableName: string,
    options?: ResourceListOptions,
  ): Promise<ResourceBrowserListing> {
    const decodedCursor = decodeCursor(options?.cursor)
    let page = await this.loadSnapshotPage({
      tableName,
      cursor: decodedCursor?.cursor,
      snapshot: decodedCursor?.snapshot,
    })

    if (options?.search?.trim()) {
      let guard = 0
      let matchedValues = page.values.filter((value) => matchesSearch(options.search, value))

      while (!matchedValues.length && page.hasMore && guard < 20) {
        page = await this.loadSnapshotPage({
          tableName,
          cursor: page.cursor,
          snapshot: page.snapshot,
        })
        matchedValues = page.values.filter((value) => matchesSearch(options.search, value))
        guard += 1
      }

      page = {
        ...page,
        values: matchedValues,
      }
    }

    const schemas = await this.loadSchemas()
    const schema = schemas.find((entry) => entry.tableName === tableName)
    const columnNames = Array.from(new Set(page.values.flatMap((value) => Object.keys(value))))
    const rows = page.values.map((value) =>
      Object.fromEntries(columnNames.map((column) => [column, value[column]])),
    )

    return {
      path: tableName,
      items: page.values.map((value, index) => {
        const documentId = typeof value._id === 'string' ? value._id : `row-${index + 1}`
        return {
          id: documentId,
          name: documentId,
          kind: 'item',
          path: `${tableName}/_doc/${encodeURIComponent(documentId)}`,
          description: 'document',
          metadata: {
            ...(value._ts !== undefined ? { ts: toMetadataValue(value._ts) } : {}),
          },
        }
      }),
      preview: {
        type: 'table',
        title: `Documents • ${tableName}`,
        columns: columnNames,
        rows,
      },
      details: {
        name: tableName,
        kind: 'container',
        path: tableName,
        metadata: {
          snapshot: page.snapshot,
          returned: page.values.length,
          ...(schema ? { fieldCount: schema.fieldNames.length } : {}),
        },
      },
      page: {
        returned: page.values.length,
        hasMore: page.hasMore,
        nextCursor: page.hasMore ? encodeCursor({ snapshot: page.snapshot, cursor: page.cursor }) : null,
      },
    }
  }

  private async getDocument(tableName: string, documentId: string): Promise<ResourceBrowserListing> {
    let nextCursor: string | undefined
    let snapshot: number | undefined
    let guard = 0

    while (guard < 100) {
      const page = await this.loadSnapshotPage({
        tableName,
        cursor: nextCursor,
        snapshot,
      })
      const document = page.values.find((value) => String(value._id ?? '') === documentId)

      if (document) {
        return {
          path: `${tableName}/_doc/${encodeURIComponent(documentId)}`,
          items: [],
          preview: {
            type: 'json',
            title: `Document • ${documentId}`,
            value: document,
          },
          details: {
            name: documentId,
            kind: 'item',
            path: `${tableName}/_doc/${encodeURIComponent(documentId)}`,
            metadata: {
              table: tableName,
              ...(document._ts !== undefined ? { ts: toMetadataValue(document._ts) } : {}),
            },
          },
        }
      }

      if (!page.hasMore) {
        break
      }

      nextCursor = page.cursor
      snapshot = page.snapshot
      guard += 1
    }

    throw new Error(`The document ${documentId} could not be found in ${tableName}.`)
  }
}
