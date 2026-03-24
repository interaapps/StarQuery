import type { AxiosInstance } from 'axios'
import type {
  AdminApiKeyRecord,
  AdminBootstrapPayload,
  AdminRoleRecord,
  AdminUserRecord,
} from '@/types/admin'

export async function fetchAdminBootstrap(client: AxiosInstance) {
  const response = await client.get('/api/admin/bootstrap')
  return response.data as AdminBootstrapPayload
}

export async function createAdminRole(
  client: AxiosInstance,
  payload: { name: string; slug?: string; description?: string | null; permissions: string[] },
) {
  const response = await client.post('/api/admin/roles', payload)
  return response.data as AdminRoleRecord
}

export async function updateAdminRole(
  client: AxiosInstance,
  roleId: string,
  payload: { name: string; slug?: string; description?: string | null; permissions: string[] },
) {
  const response = await client.put(`/api/admin/roles/${roleId}`, payload)
  return response.data as AdminRoleRecord
}

export async function deleteAdminRole(client: AxiosInstance, roleId: string) {
  await client.delete(`/api/admin/roles/${roleId}`)
}

export async function createAdminUser(
  client: AxiosInstance,
  payload: {
    email: string
    name: string
    password: string
    permissions: string[]
    roleIds: string[]
    disabled?: boolean
  },
) {
  const response = await client.post('/api/admin/users', payload)
  return response.data as AdminUserRecord
}

export async function updateAdminUser(
  client: AxiosInstance,
  userId: string,
  payload: {
    email: string
    name: string
    password?: string
    permissions: string[]
    roleIds: string[]
    disabled: boolean
  },
) {
  const response = await client.put(`/api/admin/users/${userId}`, payload)
  return response.data as AdminUserRecord
}

export async function deleteAdminUser(client: AxiosInstance, userId: string) {
  await client.delete(`/api/admin/users/${userId}`)
}

export async function createAdminApiKey(
  client: AxiosInstance,
  userId: string,
  payload: { name: string; expiresInDays?: number | null },
) {
  const response = await client.post(`/api/admin/users/${userId}/api-keys`, payload)
  return response.data as AdminApiKeyRecord & { token: string }
}

export async function deleteAdminApiKey(client: AxiosInstance, tokenId: string) {
  await client.delete(`/api/admin/api-keys/${tokenId}`)
}
