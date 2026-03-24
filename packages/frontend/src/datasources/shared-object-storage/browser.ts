function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '')
}

export function isContainerResourcePath(path: string) {
  return !path || path.endsWith('/')
}

export function getResourceName(path: string) {
  const trimmed = trimSlashes(path)
  if (!trimmed) {
    return ''
  }

  const parts = trimmed.split('/')
  return parts[parts.length - 1] ?? trimmed
}

export function getContainerResourcePath(path: string) {
  if (!path) {
    return ''
  }

  if (isContainerResourcePath(path)) {
    return `${trimSlashes(path)}/`.replace(/^\/$/, '')
  }

  const parts = trimSlashes(path).split('/')
  if (parts.length <= 1) {
    return `${parts[0]}/`
  }

  return `${parts.slice(0, -1).join('/')}/`
}

export function getParentResourcePath(path: string) {
  const containerPath = getContainerResourcePath(path)
  const trimmed = trimSlashes(containerPath)
  if (!trimmed) {
    return ''
  }

  const parts = trimmed.split('/')
  if (parts.length <= 1) {
    return ''
  }

  return `${parts.slice(0, -1).join('/')}/`
}

export function joinResourcePath(containerPath: string, name: string) {
  const trimmedName = name.replace(/^\/+/, '')
  if (!trimmedName) {
    return trimSlashes(containerPath) ? `${trimSlashes(containerPath)}/` : ''
  }

  const normalizedContainer = trimSlashes(containerPath)
  return normalizedContainer ? `${normalizedContainer}/${trimmedName}` : trimmedName
}

export function resolveObjectStorageInitialState(path: string | undefined, defaultBucket?: string) {
  const normalizedPath = trimSlashes(path ?? '')
  const fallbackContainer = trimSlashes(defaultBucket ?? '')
  const nextPath = normalizedPath || (fallbackContainer ? `${fallbackContainer}/` : '')

  if (!nextPath) {
    return {
      containerPath: '',
      selectedPath: '',
    }
  }

  if (isContainerResourcePath(nextPath)) {
    return {
      containerPath: `${trimSlashes(nextPath)}/`,
      selectedPath: '',
    }
  }

  return {
    containerPath: getContainerResourcePath(nextPath),
    selectedPath: nextPath,
  }
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(downloadUrl)
}
