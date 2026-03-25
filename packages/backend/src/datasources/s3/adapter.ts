import { createRequire } from 'node:module'
import type { BucketItem, Client } from 'minio'
import type * as MinioNamespace from 'minio'
import type { Readable } from 'node:stream'
import type { ResourceBrowserItem, ResourceBrowserListing } from '../types.ts'
import { buildS3ObjectDetails, buildS3ObjectPreview, getS3ContentType, getS3PreviewByteLimit } from './preview.ts'
import { getS3ParentPath, getS3ResourceName, parseS3ResourcePath } from './paths.ts'
import type { ResourceDataSourceAdapter, ResourceDeleteResult, ResourceListOptions } from '../shared-resource/types.ts'
import type { S3CompatibleConfig } from './config.ts'

const DEFAULT_LIST_LIMIT = 200
const MAX_LIST_LIMIT = 500
const DELETE_BATCH_SIZE = 1000

type MinioModule = typeof MinioNamespace

function streamToBuffer(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function matchesSearch(resource: { name: string; path: string; description?: string }, search?: string) {
  if (!search?.trim()) {
    return true
  }

  const normalizedSearch = search.trim().toLowerCase()
  return [resource.name, resource.path, resource.description]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch))
}

function normalizeListLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_LIST_LIMIT
  }

  return Math.min(Math.max(Math.floor(value ?? DEFAULT_LIST_LIMIT), 25), MAX_LIST_LIMIT)
}

function getBucketCursorIndex(bucketNames: string[], cursor?: string) {
  if (!cursor) {
    return 0
  }

  const foundIndex = bucketNames.findIndex((name) => name === cursor)
  return foundIndex >= 0 ? foundIndex + 1 : 0
}

function getBucketItemCursor(item: BucketItem) {
  return 'prefix' in item ? item.prefix : item.name
}

function mapBucketItem(bucket: string, item: BucketItem): ResourceBrowserItem {
  if ('prefix' in item) {
    const cleanPrefix = item.prefix.replace(/^\/+|\/+$/g, '')
    const parts = cleanPrefix.split('/')

    return {
      id: `${bucket}/${cleanPrefix}/`,
      name: parts[parts.length - 1] ?? cleanPrefix,
      kind: 'container',
      path: `${bucket}/${cleanPrefix}/`,
    }
  }

  const objectName = item.name
  const parts = objectName.split('/')

  return {
    id: `${bucket}/${objectName}`,
    name: parts[parts.length - 1] ?? objectName,
    kind: 'item',
    path: `${bucket}/${objectName}`,
    metadata: {
      size: Number(item.size ?? 0),
      updatedAt:
        item.lastModified instanceof Date ? item.lastModified.toISOString() : String(item.lastModified ?? ''),
    },
  }
}

export class S3ResourceAdapter implements ResourceDataSourceAdapter {
  private static readonly require = createRequire(import.meta.url)
  private client!: Client

  constructor(private readonly config: S3CompatibleConfig) {}

  private loadMinioModule() {
    return S3ResourceAdapter.require('minio') as MinioModule
  }

  async connect() {
    const { Client } = this.loadMinioModule()
    this.client = new Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      region: this.config.region,
      sessionToken: this.config.sessionToken,
      pathStyle: this.config.pathStyle,
    })
  }

  async close() {}

  async list(path: string, options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const parsed = parseS3ResourcePath(path)
    if (parsed.isRoot) {
      return this.listBuckets(options)
    }

    if (parsed.isContainer) {
      return this.listBucketPath(parsed.containerPath, options)
    }

    if (!parsed.bucket || !parsed.objectKey) {
      return this.listBuckets(options)
    }

    return this.getObjectListing(parsed.itemPath)
  }

  async deletePaths(paths: string[]): Promise<ResourceDeleteResult> {
    const normalizedPaths = Array.from(
      new Set(
        paths
          .map((path) => path.trim())
          .filter(Boolean),
      ),
    )

    if (!normalizedPaths.length) {
      return {
        deletedPaths: [],
        deletedCount: 0,
      }
    }

    for (const path of normalizedPaths) {
      await this.deletePath(path)
    }

    return {
      deletedPaths: normalizedPaths,
      deletedCount: normalizedPaths.length,
    }
  }

  async downloadObject(path: string) {
    const parsed = parseS3ResourcePath(path)
    if (!parsed.bucket || !parsed.objectKey || parsed.isContainer) {
      throw new Error('A full object path is required')
    }

    const [stat, stream] = await Promise.all([
      this.client.statObject(parsed.bucket, parsed.objectKey),
      this.client.getObject(parsed.bucket, parsed.objectKey),
    ])

    return {
      stream,
      fileName: getS3ResourceName(parsed.itemPath),
      contentType: getS3ContentType(stat.metaData) ?? 'application/octet-stream',
      size: typeof stat.size === 'number' ? stat.size : null,
    }
  }

  async putObject(path: string, input: { body: Buffer; contentType?: string | null }) {
    const parsed = parseS3ResourcePath(path)
    if (!parsed.bucket || !parsed.objectKey) {
      throw new Error('A target bucket and object key are required')
    }

    const metaData = input.contentType ? { 'Content-Type': input.contentType } : undefined
    await this.client.putObject(parsed.bucket, parsed.objectKey, input.body, input.body.length, metaData)
    return this.getObjectListing(parsed.itemPath)
  }

  private async listBuckets(options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const limit = normalizeListLimit(options?.limit)
    const buckets = await this.client.listBuckets()
    const filteredBuckets = buckets
      .sort((left, right) => left.name.localeCompare(right.name))
      .filter((bucket) =>
        matchesSearch(
          {
            name: bucket.name,
            path: `${bucket.name}/`,
          },
          options?.search,
        ),
      )

    const startIndex = getBucketCursorIndex(
      filteredBuckets.map((bucket) => bucket.name),
      options?.cursor,
    )
    const visibleBuckets = filteredBuckets.slice(startIndex, startIndex + limit + 1)
    const nextCursorBucket = visibleBuckets.slice(0, limit)
    const hasMore = visibleBuckets.length > limit

    return {
      path: '',
      items: visibleBuckets.slice(0, limit).map((bucket) => ({
        id: bucket.name,
        name: bucket.name,
        kind: 'container' as const,
        path: `${bucket.name}/`,
        metadata: {
          createdAt: bucket.creationDate?.toISOString?.() ?? null,
        },
      })),
      preview: null,
      details: null,
      page: {
        returned: Math.min(visibleBuckets.length, limit),
        hasMore,
        nextCursor: hasMore ? nextCursorBucket[nextCursorBucket.length - 1]?.name ?? null : null,
      },
    }
  }

  private async listBucketPath(path: string, options?: ResourceListOptions): Promise<ResourceBrowserListing> {
    const parsed = parseS3ResourcePath(path)
    if (!parsed.bucket) {
      return this.listBuckets(options)
    }

    const prefix = parsed.objectKey ? `${parsed.objectKey.replace(/\/+$/, '')}/` : ''
    const limit = normalizeListLimit(options?.limit)
    const matchedItems: ResourceBrowserItem[] = []
    let startAfter = options?.cursor ?? ''
    let hasMore = false
    let nextCursor: string | null = null

    while (matchedItems.length < limit) {
      const response = await this.client.listObjectsV2Query(
        parsed.bucket,
        prefix,
        '',
        '/',
        Math.min(Math.max(limit * 2, 100), 1000),
        startAfter,
      )

      if (!response.objects.length) {
        hasMore = false
        nextCursor = null
        break
      }

      for (let index = 0; index < response.objects.length; index += 1) {
        const bucketItem = response.objects[index]!
        const cursor = getBucketItemCursor(bucketItem)
        startAfter = cursor
        const resourceItem = mapBucketItem(parsed.bucket, bucketItem)
        if (!matchesSearch(resourceItem, options?.search)) {
          continue
        }

        matchedItems.push(resourceItem)
        if (matchedItems.length >= limit) {
          hasMore = index < response.objects.length - 1 || response.isTruncated
          nextCursor = cursor
          break
        }
      }

      if (matchedItems.length >= limit) {
        break
      }

      if (!response.isTruncated) {
        hasMore = false
        nextCursor = null
        break
      }

      hasMore = true
      nextCursor = startAfter
    }

    return {
      path: parsed.containerPath,
      items: matchedItems,
      preview: {
        type: 'text',
        title: `Bucket • ${parsed.bucket}`,
        text: prefix ? `Prefix: ${prefix}` : 'Bucket root',
      },
      details: {
        name: parsed.name || parsed.bucket,
        kind: 'container',
        path: parsed.containerPath,
        metadata: {
          bucket: parsed.bucket,
          prefix: prefix || null,
          parentPath: getS3ParentPath(parsed.containerPath) || null,
        },
      },
      page: {
        returned: matchedItems.length,
        hasMore,
        nextCursor,
      },
    }
  }

  private async getObjectListing(path: string): Promise<ResourceBrowserListing> {
    const parsed = parseS3ResourcePath(path)
    if (!parsed.bucket || !parsed.objectKey) {
      return this.listBuckets()
    }

    const stat = await this.client.statObject(parsed.bucket, parsed.objectKey)
    let preview = null

    try {
      const previewStream = await this.client.getPartialObject(
        parsed.bucket,
        parsed.objectKey,
        0,
        getS3PreviewByteLimit(),
      )
      const previewBuffer = await streamToBuffer(previewStream)
      preview = buildS3ObjectPreview({
        objectName: parsed.objectKey,
        contentType: getS3ContentType(stat.metaData),
        size: typeof stat.size === 'number' ? stat.size : null,
        buffer: previewBuffer,
      })
    } catch {
      preview = null
    }

    return {
      path: parsed.itemPath,
      items: [],
      preview,
      details: buildS3ObjectDetails({
        path: parsed.itemPath,
        name: parsed.name,
        stat,
      }),
      page: null,
    }
  }

  private async deletePath(path: string) {
    const parsed = parseS3ResourcePath(path)
    if (!parsed.bucket) {
      throw new Error('A bucket path is required')
    }

    if (!parsed.objectKey) {
      throw new Error('Deleting buckets is not supported')
    }

    if (!parsed.isContainer) {
      await this.client.removeObject(parsed.bucket, parsed.objectKey)
      return
    }

    let batch: string[] = []
    const stream = this.client.listObjectsV2(parsed.bucket, `${parsed.objectKey.replace(/\/+$/, '')}/`, true)
    for await (const item of stream) {
      if (!item.name) {
        continue
      }

      batch.push(item.name)
      if (batch.length < DELETE_BATCH_SIZE) {
        continue
      }

      await this.client.removeObjects(parsed.bucket, batch)
      batch = []
    }

    if (batch.length) {
      await this.client.removeObjects(parsed.bucket, batch)
    }
  }
}
