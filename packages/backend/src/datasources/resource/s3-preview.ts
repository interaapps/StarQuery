import path from 'node:path'
import type { BucketItemStat } from 'minio'
import type { ResourceBrowserDetails, ResourceBrowserPreview } from '../types.ts'

const MAX_PREVIEW_BYTES = 64 * 1024
const JSON_CONTENT_TYPE_PATTERN = /\b(json|ndjson)\b/i
const TEXT_CONTENT_TYPE_PATTERN = /^(text\/|application\/(xml|javascript|typescript|x-www-form-urlencoded))/i
const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.log',
  '.md',
  '.csv',
  '.tsv',
  '.json',
  '.ndjson',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.html',
  '.xml',
  '.yml',
  '.yaml',
  '.ini',
  '.toml',
  '.sql',
])

function stringifyMetadataValue(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return String(value)
}

export function getS3ContentType(metaData?: Record<string, unknown>) {
  const value =
    metaData?.['content-type'] ??
    metaData?.['Content-Type'] ??
    metaData?.['ContentType'] ??
    metaData?.['contentType']

  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function normalizeS3Metadata(metaData?: Record<string, unknown>) {
  if (!metaData) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(metaData).map(([key, value]) => [
      key,
      stringifyMetadataValue(value),
    ]),
  ) as Record<string, string | number | boolean | null>
}

function isProbablyTextBuffer(buffer: Buffer) {
  let suspiciousByteCount = 0

  for (const byte of buffer) {
    if (byte === 9 || byte === 10 || byte === 13) {
      continue
    }

    if (byte >= 32 && byte <= 126) {
      continue
    }

    if (byte === 0) {
      return false
    }

    suspiciousByteCount += 1
  }

  return suspiciousByteCount / Math.max(buffer.length, 1) < 0.15
}

function appendTruncationHint(text: string, isTruncated: boolean) {
  if (!isTruncated) {
    return text
  }

  return `${text}\n\n… Preview truncated after ${MAX_PREVIEW_BYTES} bytes.`
}

export function buildS3ObjectPreview(input: {
  objectName: string
  contentType: string | null
  size: number | null
  buffer: Buffer
}): ResourceBrowserPreview | null {
  const extension = path.extname(input.objectName).toLowerCase()
  const isTruncated = typeof input.size === 'number' && input.size > input.buffer.length
  const contentType = input.contentType ?? ''
  const treatAsJson = JSON_CONTENT_TYPE_PATTERN.test(contentType) || extension === '.json' || extension === '.ndjson'
  const treatAsText =
    treatAsJson ||
    TEXT_CONTENT_TYPE_PATTERN.test(contentType) ||
    TEXT_EXTENSIONS.has(extension) ||
    isProbablyTextBuffer(input.buffer)

  if (!treatAsText) {
    return null
  }

  const text = input.buffer.toString('utf8')
  if (treatAsJson) {
    try {
      return {
        type: 'json',
        title: `Preview • ${path.basename(input.objectName)}`,
        value: JSON.parse(text),
      }
    } catch {
      return {
        type: 'text',
        title: `Preview • ${path.basename(input.objectName)}`,
        text: appendTruncationHint(text, isTruncated),
      }
    }
  }

  return {
    type: 'text',
    title: `Preview • ${path.basename(input.objectName)}`,
    text: appendTruncationHint(text, isTruncated),
  }
}

export function buildS3ObjectDetails(input: {
  path: string
  name: string
  stat: BucketItemStat
}): ResourceBrowserDetails {
  const contentType = getS3ContentType(input.stat.metaData)

  return {
    name: input.name,
    kind: 'item',
    path: input.path,
    contentType,
    size: typeof input.stat.size === 'number' ? input.stat.size : null,
    updatedAt: input.stat.lastModified?.toISOString?.() ?? null,
    etag: input.stat.etag ?? null,
    metadata: normalizeS3Metadata(input.stat.metaData),
  }
}

export function getS3PreviewByteLimit() {
  return MAX_PREVIEW_BYTES
}
