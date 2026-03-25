import { createRequire } from 'node:module'
import type { Client } from '@elastic/elasticsearch'
import type * as ElasticsearchNamespace from '@elastic/elasticsearch'
import type { ResourceBrowserItem, ResourceBrowserListing } from '../types.ts'
import type { ResourceDataSourceAdapter, ResourceListOptions } from '../shared-resource/types.ts'

type ElasticsearchConfig = {
  node: string
  username?: string
  password?: string
  apiKey?: string
}

type ElasticsearchModule = typeof ElasticsearchNamespace

export type ElasticsearchSearchHit = {
  id: string
  index: string
  score: number | null
  source: Record<string, unknown>
  sort: unknown[] | null
}

export type ElasticsearchSearchResponse = {
  index: string
  tookMs: number | null
  total: number | null
  hits: ElasticsearchSearchHit[]
}

export type ElasticsearchDocumentMutation = {
  inserted?: Array<Record<string, unknown>>
  updated?: Array<{
    id: string
    document: Record<string, unknown>
  }>
  deleted?: string[]
}

export type ElasticsearchMutationResult = {
  tookMs: number | null
  inserted: number
  updated: number
  deleted: number
}

function unwrapElasticBody<T>(response: T | { body?: T }) {
  if (response && typeof response === 'object' && 'body' in response) {
    return (response as { body?: T }).body ?? (response as T)
  }

  return response as T
}

function normalizeTotalHits(total: unknown) {
  if (typeof total === 'number') {
    return total
  }

  if (total && typeof total === 'object' && 'value' in total) {
    const value = Number((total as { value?: unknown }).value)
    return Number.isFinite(value) ? value : null
  }

  return null
}

export class ElasticsearchResourceAdapter implements ResourceDataSourceAdapter {
  private static readonly require = createRequire(import.meta.url)
  private client!: Client

  constructor(private readonly config: ElasticsearchConfig) {}

  private loadElasticsearchModule() {
    return ElasticsearchResourceAdapter.require('@elastic/elasticsearch') as ElasticsearchModule
  }

  async connect() {
    const { Client } = this.loadElasticsearchModule()
    this.client = new Client({
      node: this.config.node,
      auth: this.config.apiKey
        ? { apiKey: this.config.apiKey }
        : this.config.username
          ? {
              username: this.config.username,
              password: this.config.password ?? '',
            }
          : undefined,
    })
  }

  async close() {
    await this.client.close()
  }

  async list(path: string, _options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')
    const segments = normalizedPath ? normalizedPath.split('/').filter(Boolean) : []

    if (segments.length === 0) {
      return this.listIndices()
    }

    if (segments.length === 1) {
      return this.listIndexContents(segments[0]!)
    }

    if (segments.length >= 3 && segments[1] === '_doc') {
      return this.getDocument(segments[0]!, decodeURIComponent(segments.slice(2).join('/')))
    }

    throw new Error('Unsupported Elasticsearch resource path')
  }

  async searchIndex(index: string, request: Record<string, unknown>): Promise<ElasticsearchSearchResponse> {
    const response = await this.client.search({
      index,
      ...(request as Record<string, unknown>),
    })
    const body = unwrapElasticBody<Record<string, unknown>>(response as unknown as { body?: Record<string, unknown> })
    const hitsContainer = (body.hits as Record<string, unknown> | undefined) ?? {}
    const hits = (hitsContainer.hits as Array<Record<string, unknown>> | undefined) ?? []

    return {
      index,
      tookMs: typeof body.took === 'number' ? body.took : null,
      total: normalizeTotalHits(hitsContainer.total),
      hits: hits.map((hit) => ({
        id: String(hit._id ?? ''),
        index: String(hit._index ?? index),
        score: typeof hit._score === 'number' ? hit._score : null,
        source: (hit._source as Record<string, unknown> | undefined) ?? {},
        sort: Array.isArray(hit.sort) ? hit.sort : null,
      })),
    }
  }

  async saveDocuments(index: string, mutations: ElasticsearchDocumentMutation): Promise<ElasticsearchMutationResult> {
    const operations: Array<Record<string, unknown>> = []

    for (const document of mutations.inserted ?? []) {
      operations.push({ index: { _index: index } }, document)
    }

    for (const update of mutations.updated ?? []) {
      operations.push({ index: { _index: index, _id: update.id } }, update.document)
    }

    for (const documentId of mutations.deleted ?? []) {
      operations.push({ delete: { _index: index, _id: documentId } })
    }

    if (!operations.length) {
      return {
        tookMs: 0,
        inserted: 0,
        updated: 0,
        deleted: 0,
      }
    }

    const response = await this.client.bulk({
      refresh: 'wait_for',
      operations,
    })
    const body = unwrapElasticBody<Record<string, unknown>>(response as unknown as { body?: Record<string, unknown> })
    const items = Array.isArray(body.items) ? body.items : []
    const failedItem = items.find((item) =>
      Object.values(item as Record<string, unknown>).some(
        (entry) => !!entry && typeof entry === 'object' && 'error' in (entry as Record<string, unknown>),
      ),
    )

    if (failedItem) {
      const failedEntry = Object.values(failedItem as Record<string, unknown>).find(
        (entry) => !!entry && typeof entry === 'object' && 'error' in (entry as Record<string, unknown>),
      ) as { error?: { reason?: string; type?: string } } | undefined
      throw new Error(failedEntry?.error?.reason || failedEntry?.error?.type || 'The Elasticsearch bulk write failed')
    }

    return {
      tookMs: typeof body.took === 'number' ? body.took : null,
      inserted: mutations.inserted?.length ?? 0,
      updated: mutations.updated?.length ?? 0,
      deleted: mutations.deleted?.length ?? 0,
    }
  }

  private async listIndices(): Promise<ResourceBrowserListing> {
    const response = await this.client.cat.indices({
      format: 'json',
      expand_wildcards: 'all',
    })
    const rows = (response as { body?: Array<Record<string, unknown>> }).body ?? (response as Array<Record<string, unknown>>)

    const items: ResourceBrowserItem[] = rows
      .map((row) => {
        const indexName = String(row.index ?? '').trim()
        if (!indexName) {
          return null
        }

        return {
          id: indexName,
          name: indexName,
          kind: 'container' as const,
          path: indexName,
          description: `${row['docs.count'] ?? 0} docs`,
          metadata: {
            health: row.health ? String(row.health) : null,
            status: row.status ? String(row.status) : null,
            docs: Number(row['docs.count'] ?? 0),
            size: row['store.size'] ? String(row['store.size']) : null,
          },
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return {
      path: '',
      items,
      preview: null,
    }
  }

  private async listIndexContents(index: string): Promise<ResourceBrowserListing> {
    const [mappingResponse, searchResponse] = await Promise.all([
      this.client.indices.getMapping({ index }),
      this.client.search({
        index,
        size: 50,
        query: {
          match_all: {},
        },
      }),
    ])

    const mappings =
      (mappingResponse as { body?: Record<string, unknown> }).body ??
      (mappingResponse as unknown as Record<string, unknown>)
    const searchBody =
      (searchResponse as { body?: Record<string, unknown> }).body ?? (searchResponse as unknown as Record<string, unknown>)
    const hits = ((searchBody.hits as Record<string, unknown> | undefined)?.hits as Array<Record<string, unknown>> | undefined) ?? []

    return {
      path: index,
      items: hits.map((hit) => {
        const documentId = String(hit._id ?? '')
        const source = (hit._source as Record<string, unknown> | undefined) ?? {}

        return {
          id: documentId,
          name: documentId,
          kind: 'item',
          path: `${index}/_doc/${encodeURIComponent(documentId)}`,
          description: Object.keys(source).slice(0, 4).join(', '),
        }
      }),
      preview: {
        type: 'json',
        title: `Mapping • ${index}`,
        value: mappings[index] ?? mappings,
      },
    }
  }

  private async getDocument(index: string, documentId: string): Promise<ResourceBrowserListing> {
    const response = await this.client.get({
      index,
      id: documentId,
    })
    const body = unwrapElasticBody<Record<string, unknown>>(response as unknown as { body?: Record<string, unknown> })
    const source = (body._source as Record<string, unknown> | undefined) ?? {}

    return {
      path: `${index}/_doc/${encodeURIComponent(documentId)}`,
      items: [],
      preview: {
        type: 'json',
        title: `Document • ${documentId}`,
        value: source,
      },
      details: {
        name: documentId,
        kind: 'item',
        path: `${index}/_doc/${encodeURIComponent(documentId)}`,
        contentType: 'application/json',
        metadata: {
          index,
          id: documentId,
          version: typeof body._version === 'number' ? body._version : null,
        },
      },
    }
  }
}
