import { createRequire } from 'node:module'
import type * as BsonNamespace from 'bson'
import type { Document, MongoClient } from 'mongodb'
import type * as MongoDbNamespace from 'mongodb'
import type { Sort } from 'mongodb'
import type { ResourceBrowserItem, ResourceBrowserListing } from '../types.ts'
import type { ResourceDataSourceAdapter, ResourceListOptions } from '../shared-resource/types.ts'

type MongoDbConfig = {
  uri?: string
  host?: string
  port?: number
  username?: string
  password?: string
  database?: string
  authSource?: string
  ssl?: boolean
}

type MongoDbModule = typeof MongoDbNamespace
type BsonModule = typeof BsonNamespace

export type MongoDbSerializedDocument = {
  idLabel: string
  idValue: unknown
  document: Record<string, unknown>
}

export type MongoDbQueryResult = {
  database: string
  collection: string
  total: number
  skip: number
  limit: number
  returned: number
  documents: MongoDbSerializedDocument[]
}

function buildMongoUri(config: MongoDbConfig) {
  if (config.uri?.trim()) {
    return config.uri.trim()
  }

  const credentials =
    config.username
      ? `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password ?? '')}@`
      : ''
  const host = config.host?.trim() || '127.0.0.1'
  const port = config.port ?? 27017
  const database = config.database?.trim() || 'admin'
  const params = new URLSearchParams()

  if (config.authSource?.trim()) {
    params.set('authSource', config.authSource.trim())
  }

  if (config.ssl) {
    params.set('tls', 'true')
  }

  const query = params.toString()
  return `mongodb://${credentials}${host}:${port}/${database}${query ? `?${query}` : ''}`
}

function matchesSearch(search: string | undefined, ...values: Array<string | undefined>) {
  if (!search?.trim()) {
    return true
  }

  const needle = search.trim().toLowerCase()
  return values.filter(Boolean).some((value) => value!.toLowerCase().includes(needle))
}

function parseMongoPath(path: string) {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '')
  const segments = normalizedPath ? normalizedPath.split('/').filter(Boolean) : []

  return {
    path: normalizedPath,
    segments,
    database: segments[0],
    collection: segments[1],
    documentIdToken:
      segments[2] === '_doc' ? decodeURIComponent(segments.slice(3).join('/')) : undefined,
  }
}

function ensureRecord(value: unknown, message: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message)
  }

  return value as Record<string, unknown>
}

export class MongoDbResourceAdapter implements ResourceDataSourceAdapter {
  private static readonly require = createRequire(import.meta.url)
  private client!: MongoClient
  private mongoModule!: MongoDbModule
  private bsonModule!: BsonModule

  constructor(private readonly config: MongoDbConfig) {}

  private loadMongoModule() {
    if (!this.mongoModule) {
      this.mongoModule = MongoDbResourceAdapter.require('mongodb') as MongoDbModule
    }

    return this.mongoModule
  }

  private loadBsonModule() {
    if (!this.bsonModule) {
      this.bsonModule = MongoDbResourceAdapter.require('bson') as BsonModule
    }

    return this.bsonModule
  }

  private serializeValue<T>(value: T): T {
    if (value === undefined) {
      return null as T
    }

    const { EJSON } = this.loadBsonModule()
    return JSON.parse(EJSON.stringify(value, { relaxed: false })) as T
  }

  private deserializeValue<T>(value: T): T {
    const { EJSON } = this.loadBsonModule()
    return EJSON.deserialize(value, { relaxed: false }) as T
  }

  private getCollection(databaseName: string, collectionName: string) {
    return this.client.db(databaseName).collection(collectionName)
  }

  private parseDocumentIdToken(documentIdToken: string) {
    try {
      return this.deserializeValue(JSON.parse(documentIdToken))
    } catch {
      const { ObjectId } = this.loadMongoModule()
      return ObjectId.isValid(documentIdToken) ? new ObjectId(documentIdToken) : documentIdToken
    }
  }

  private serializeDocument(document: Document): MongoDbSerializedDocument {
    const serializedDocument = ensureRecord(
      this.serializeValue(document),
      'The MongoDB document could not be serialized',
    )
    const serializedId = serializedDocument._id ?? null

    return {
      idLabel:
        typeof serializedId === 'string'
          ? serializedId
          : serializedId === null
            ? '(no _id)'
            : JSON.stringify(serializedId),
      idValue: serializedId,
      document: serializedDocument,
    }
  }

  private createDocumentItem(databaseName: string, collectionName: string, document: Document): ResourceBrowserItem {
    const serializedDocument = this.serializeDocument(document)
    const encodedIdToken = encodeURIComponent(JSON.stringify(serializedDocument.idValue))

    return {
      id: `${databaseName}/${collectionName}/_doc/${encodedIdToken}`,
      name: serializedDocument.idLabel,
      kind: 'item',
      path: `${databaseName}/${collectionName}/_doc/${encodedIdToken}`,
      description: 'document',
    }
  }

  async connect() {
    const { MongoClient } = this.loadMongoModule()
    this.client = new MongoClient(buildMongoUri(this.config))
    await this.client.connect()
  }

  async close() {
    await this.client?.close()
  }

  async list(path: string, options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const parsed = parseMongoPath(path)

    if (!parsed.database) {
      return this.listDatabases(options)
    }

    if (!parsed.collection) {
      return this.listCollections(parsed.database, options)
    }

    if (!parsed.documentIdToken) {
      return this.listDocuments(parsed.database, parsed.collection, options)
    }

    return this.getDocument(parsed.database, parsed.collection, parsed.documentIdToken)
  }

  async queryCollection(input: {
    database: string
    collection: string
    filter?: Record<string, unknown>
    sort?: Record<string, unknown>
    projection?: Record<string, unknown>
    skip?: number
    limit?: number
  }): Promise<MongoDbQueryResult> {
    const collection = this.getCollection(input.database, input.collection)
    const filter = ensureRecord(
      this.deserializeValue(input.filter ?? {}),
      'filter must be a JSON object',
    )
    const sort = input.sort ? ensureRecord(this.deserializeValue(input.sort), 'sort must be a JSON object') : undefined
    const projection = input.projection
      ? ensureRecord(this.deserializeValue(input.projection), 'projection must be a JSON object')
      : undefined
    const skip = Math.max(0, Math.floor(input.skip ?? 0))
    const limit = Math.min(Math.max(1, Math.floor(input.limit ?? 50)), 500)

    const total = await collection.countDocuments(filter as never)
    const documents = await collection
      .find(filter as never, {
        ...(projection ? { projection } : {}),
      })
      .sort((sort ?? { _id: -1 }) as Sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    return {
      database: input.database,
      collection: input.collection,
      total,
      skip,
      limit,
      returned: documents.length,
      documents: documents.map((document) => this.serializeDocument(document)),
    }
  }

  async insertDocument(input: {
    database: string
    collection: string
    document: Record<string, unknown>
  }) {
    const collection = this.getCollection(input.database, input.collection)
    const document = ensureRecord(
      this.deserializeValue(input.document),
      'document must be a JSON object',
    )
    const result = await collection.insertOne(document as never)
    const insertedDocument = await collection.findOne({ _id: result.insertedId } as never)

    if (!insertedDocument) {
      throw new Error('The inserted MongoDB document could not be loaded again')
    }

    return {
      insertedId: this.serializeValue(result.insertedId),
      document: this.serializeDocument(insertedDocument),
    }
  }

  async replaceDocument(input: {
    database: string
    collection: string
    id: unknown
    document: Record<string, unknown>
  }) {
    const collection = this.getCollection(input.database, input.collection)
    const id = this.deserializeValue(input.id)
    const document = ensureRecord(
      this.deserializeValue(input.document),
      'document must be a JSON object',
    )
    document._id = id

    const result = await collection.replaceOne({ _id: id } as never, document as never)
    if (!result.matchedCount) {
      throw new Error('The MongoDB document no longer exists')
    }

    const updatedDocument = await collection.findOne({ _id: id } as never)
    if (!updatedDocument) {
      throw new Error('The updated MongoDB document could not be loaded again')
    }

    return {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      document: this.serializeDocument(updatedDocument),
    }
  }

  async deleteDocuments(input: {
    database: string
    collection: string
    ids: unknown[]
  }) {
    const collection = this.getCollection(input.database, input.collection)
    const ids = input.ids.map((id) => this.deserializeValue(id))

    if (!ids.length) {
      return {
        deletedCount: 0,
      }
    }

    const result = await collection.deleteMany({
      _id: {
        $in: ids,
      },
    } as never)

    return {
      deletedCount: result.deletedCount,
    }
  }

  async createCollection(databaseName: string, collectionName: string) {
    const createdCollection = await this.client.db(databaseName).createCollection(collectionName)
    return {
      database: databaseName,
      collection: createdCollection.collectionName,
    }
  }

  async deleteCollection(databaseName: string, collectionName: string) {
    const dropped = await this.client.db(databaseName).collection(collectionName).drop()
    return {
      database: databaseName,
      collection: collectionName,
      dropped,
    }
  }

  private async listDatabases(options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const databases = await this.client.db().admin().listDatabases()
    const limit = Math.max(options?.limit ?? 50, 1)
    const items = (databases.databases ?? [])
      .filter((database) => matchesSearch(options?.search, database.name))
      .slice(0, limit)
      .map<ResourceBrowserItem>((database) => ({
        id: database.name,
        name: database.name,
        kind: 'container',
        path: database.name,
        description: database.empty ? 'empty' : 'database',
      }))

    return {
      path: '',
      items,
      preview: null,
      details: null,
      page: {
        returned: items.length,
        hasMore: (databases.databases?.length ?? 0) > items.length,
      },
    }
  }

  private async listCollections(databaseName: string, options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const collections = await this.client.db(databaseName).listCollections({}, { nameOnly: false }).toArray()
    const limit = Math.max(options?.limit ?? 100, 1)
    const items = collections
      .filter((collection) => matchesSearch(options?.search, collection.name, collection.type))
      .slice(0, limit)
      .map<ResourceBrowserItem>((collection) => ({
        id: `${databaseName}/${collection.name}`,
        name: collection.name,
        kind: 'container',
        path: `${databaseName}/${collection.name}`,
        description: collection.type ?? 'collection',
      }))

    return {
      path: databaseName,
      items,
      preview: {
        type: 'text',
        title: `Database • ${databaseName}`,
        text: `${items.length} collection(s)`,
      },
      details: {
        name: databaseName,
        kind: 'container',
        path: databaseName,
        metadata: {
          database: databaseName,
        },
      },
      page: {
        returned: items.length,
        hasMore: collections.length > items.length,
      },
    }
  }

  private async listDocuments(
    databaseName: string,
    collectionName: string,
    options?: ResourceListOptions,
  ): Promise<ResourceBrowserListing> {
    const queryResult = await this.queryCollection({
      database: databaseName,
      collection: collectionName,
      limit: Math.max(options?.limit ?? 50, 1),
    })

    const filteredDocuments = queryResult.documents.filter((document) =>
      matchesSearch(options?.search, document.idLabel, JSON.stringify(document.document)),
    )
    const items = filteredDocuments.map((document) =>
      this.createDocumentItem(databaseName, collectionName, this.deserializeValue(document.document)),
    )
    const previewRows = filteredDocuments.map((document) => document.document)
    const previewColumns = Array.from(
      previewRows.reduce((set, row) => {
        for (const key of Object.keys(row)) {
          set.add(key)
        }

        return set
      }, new Set<string>()),
    )

    return {
      path: `${databaseName}/${collectionName}`,
      items,
      preview: {
        type: 'table',
        title: `Collection • ${collectionName}`,
        columns: previewColumns,
        rows: previewRows,
      },
      details: {
        name: collectionName,
        kind: 'container',
        path: `${databaseName}/${collectionName}`,
        metadata: {
          database: databaseName,
          collection: collectionName,
          documents: queryResult.total,
        },
      },
      page: {
        returned: items.length,
        hasMore: queryResult.skip + queryResult.returned < queryResult.total,
      },
    }
  }

  private async getDocument(
    databaseName: string,
    collectionName: string,
    documentIdToken: string,
  ): Promise<ResourceBrowserListing> {
    const documentId = this.parseDocumentIdToken(documentIdToken)
    const document = await this.client
      .db(databaseName)
      .collection(collectionName)
      .findOne({ _id: documentId } as never)

    if (!document) {
      throw new Error('Document not found')
    }

    const serializedDocument = this.serializeDocument(document)
    return {
      path: `${databaseName}/${collectionName}/_doc/${encodeURIComponent(documentIdToken)}`,
      items: [],
      preview: {
        type: 'json',
        title: `Document • ${serializedDocument.idLabel}`,
        value: serializedDocument.document,
      },
      details: {
        name: serializedDocument.idLabel,
        kind: 'item',
        path: `${databaseName}/${collectionName}/_doc/${encodeURIComponent(documentIdToken)}`,
        metadata: {
          database: databaseName,
          collection: collectionName,
        },
      },
    }
  }
}
