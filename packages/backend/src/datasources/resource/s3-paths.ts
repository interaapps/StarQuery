export type S3ResourcePath = {
  rawPath: string
  normalizedPath: string
  bucket: string | null
  objectKey: string
  isRoot: boolean
  isContainer: boolean
  itemPath: string
  containerPath: string
  name: string
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '')
}

export function getS3ResourceName(path: string) {
  const trimmed = trimSlashes(path)
  if (!trimmed) {
    return ''
  }

  const parts = trimmed.split('/')
  return parts.at(-1) ?? trimmed
}

export function parseS3ResourcePath(path: string) {
  const rawPath = String(path ?? '')
  const normalized = rawPath.trim().replace(/^\/+/, '')
  const isContainer = normalized === '' || normalized.endsWith('/')
  const trimmed = isContainer ? normalized.replace(/\/+$/, '') : normalized

  if (!trimmed) {
    return {
      rawPath,
      normalizedPath: '',
      bucket: null,
      objectKey: '',
      isRoot: true,
      isContainer: true,
      itemPath: '',
      containerPath: '',
      name: '',
    } satisfies S3ResourcePath
  }

  const [bucket, ...keySegments] = trimmed.split('/')
  const objectKey = keySegments.join('/')
  const itemPath = objectKey ? `${bucket}/${objectKey}` : bucket!
  const containerPath = objectKey ? `${bucket}/${objectKey}/` : `${bucket}/`

  return {
    rawPath,
    normalizedPath: normalized,
    bucket: bucket ?? null,
    objectKey,
    isRoot: false,
    isContainer,
    itemPath,
    containerPath,
    name: getS3ResourceName(trimmed),
  } satisfies S3ResourcePath
}

export function getS3ParentPath(path: string) {
  const parsed = parseS3ResourcePath(path)
  if (parsed.isRoot || !parsed.bucket) {
    return ''
  }

  if (!parsed.objectKey) {
    return ''
  }

  const segments = parsed.objectKey.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return `${parsed.bucket}/`
  }

  return `${parsed.bucket}/${segments.slice(0, -1).join('/')}/`
}
