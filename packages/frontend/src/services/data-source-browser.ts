import type { DataSourceResourceListing } from '@/types/datasources'
import type { AxiosInstance } from 'axios'
import { normalizeServerUrl } from '@/services/backend-api'
import { getStoredAuthTokenForUrl } from '@/services/auth-storage'
import { triggerBlobDownload } from '@/services/object-storage-browser'

export async function loadDataSourceResources(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  path?: string
  search?: string
  limit?: number
  cursor?: string
}) {
  const response = await input.client.get(`/api/projects/${input.projectId}/sources/${input.sourceId}/resources`, {
    params: {
      ...(input.path ? { path: input.path } : {}),
      ...(input.search ? { search: input.search } : {}),
      ...(typeof input.limit === 'number' ? { limit: input.limit } : {}),
      ...(input.cursor ? { cursor: input.cursor } : {}),
    },
  })

  return response.data as DataSourceResourceListing
}

function getFileNameFromContentDisposition(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1])
  }

  const basicMatch = value.match(/filename="?([^"]+)"?/i)
  return basicMatch?.[1] ?? null
}

function buildAbsoluteUrl(client: AxiosInstance, path: string, params?: Record<string, string>) {
  const baseUrl = normalizeServerUrl(client.defaults.baseURL ?? '')
  const url = new URL(path, `${baseUrl}/`)

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }

  return url
}

async function streamResponseToFile(response: Response, fileName: string) {
  const browserWindow = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string
    }) => Promise<{
      createWritable: () => Promise<WritableStream<Uint8Array>>
    }>
  }

  if (browserWindow.showSaveFilePicker && response.body) {
    const handle = await browserWindow.showSaveFilePicker({
      suggestedName: fileName,
    })
    const writable = await handle.createWritable()
    await response.body.pipeTo(writable)
    return
  }

  const blob = await response.blob()
  triggerBlobDownload(blob, fileName)
}

async function throwResponseError(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { error?: string; detail?: string }
    throw new Error(payload.detail || payload.error || `Request failed with status ${response.status}`)
  }

  const text = await response.text()
  throw new Error(text || `Request failed with status ${response.status}`)
}

export async function downloadDataSourceResourceObject(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  path: string
}) {
  const url = buildAbsoluteUrl(
    input.client,
    `/api/projects/${input.projectId}/sources/${input.sourceId}/resources/download`,
    { path: input.path },
  )
  const token = getStoredAuthTokenForUrl(normalizeServerUrl(input.client.defaults.baseURL ?? url.origin))
  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  })

  if (!response.ok) {
    await throwResponseError(response)
  }

  const fileName =
    getFileNameFromContentDisposition(response.headers.get('content-disposition')) ??
    input.path.split('/').filter(Boolean).slice(-1)[0] ??
    'download'

  await streamResponseToFile(response, fileName)

  return {
    fileName,
    contentType: response.headers.get('content-type') ?? undefined,
  }
}

export async function uploadDataSourceResourceObject(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  path: string
  body: Blob | ArrayBuffer | Uint8Array | string
  contentType?: string
}) {
  const response = await input.client.put(
    `/api/projects/${input.projectId}/sources/${input.sourceId}/resources/object`,
    input.body,
    {
      params: { path: input.path },
      headers: {
        'Content-Type': input.contentType || 'application/octet-stream',
        'X-StarQuery-Object-Content-Type': input.contentType || 'application/octet-stream',
      },
    },
  )

  return response.data as DataSourceResourceListing
}

export async function deleteDataSourceResources(input: {
  client: AxiosInstance
  projectId: string
  sourceId: string
  paths: string[]
}) {
  const response = await input.client.delete(`/api/projects/${input.projectId}/sources/${input.sourceId}/resources`, {
    data: {
      paths: input.paths,
    },
  })

  return response.data as {
    deletedPaths: string[]
    deletedCount: number
  }
}
