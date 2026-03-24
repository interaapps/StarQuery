<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import AdminRoleDialog from '@/components/admin/AdminRoleDialog.vue'
import AdminUserDialog from '@/components/admin/AdminUserDialog.vue'
import ApiKeyDialog from '@/components/admin/ApiKeyDialog.vue'
import {
  createAdminApiKey,
  createAdminRole,
  createAdminUser,
  deleteAdminApiKey,
  deleteAdminRole,
  deleteAdminUser,
  fetchAdminBootstrap,
  updateAdminRole,
  updateAdminUser,
} from '@/services/admin-api'
import {
  adminPermissionTargets,
  dataSourcePermissionTargets,
  projectPermissionTargets,
} from '@/services/permissions'
import { getErrorMessage } from '@/services/error-message'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type {
  AdminApiKeyRecord,
  AdminBootstrapPayload,
  AdminRoleRecord,
  AdminUserRecord,
  PermissionTemplate,
} from '@/types/admin'

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(false)
const data = ref<AdminBootstrapPayload>({
  users: [],
  roles: [],
  projects: [],
  dataSources: [],
  apiKeys: [],
})

const roleDialogVisible = ref(false)
const userDialogVisible = ref(false)
const apiKeyDialogVisible = ref(false)
const latestApiKeyDialogVisible = ref(false)
const editingRole = ref<AdminRoleRecord | null>(null)
const editingUser = ref<AdminUserRecord | null>(null)
const apiKeyTargetUser = ref<AdminUserRecord | null>(null)
const latestApiKey = ref<{ token: string; tokenPrefix: string; userName: string } | null>(null)

const canAccessAdmin = computed(() => authStore.hasPermission(adminPermissionTargets('access', 'read')))
const canManageRoles = computed(() => authStore.hasPermission(adminPermissionTargets('roles', 'write')))
const canManageUsers = computed(() => authStore.hasPermission(adminPermissionTargets('users', 'write')))
const canManageApiKeys = computed(() => authStore.hasPermission(adminPermissionTargets('apiKeys', 'write')))

const roleNameMap = computed(
  () =>
    new Map(
      data.value.roles.map((role) => [
        role.id,
        role,
      ]),
    ),
)
const userNameMap = computed(
  () =>
    new Map(
      data.value.users.map((user) => [
        user.id,
        user,
      ]),
    ),
)

const permissionTemplates = computed<PermissionTemplate[]>(() => {
  const lastTarget = (targets: string[], fallback: string) => targets[targets.length - 1] ?? fallback
  const helpers: PermissionTemplate[] = [
    { label: 'Full access', value: '*' },
    { label: 'Admin access', value: 'admin.*' },
    { label: 'Workspace create', value: 'project.create:write' },
    { label: 'Workspace manage all', value: 'project.manage.*:write' },
    { label: 'Workspace users all', value: 'project.users.*:write' },
    { label: 'Datasource view all', value: 'datasource.view.*:read' },
    { label: 'Datasource query read all', value: 'datasource.query.*:read' },
    { label: 'Datasource query write all', value: 'datasource.query.*:write' },
    { label: 'Datasource manage all', value: 'datasource.manage.*:write' },
    { label: 'Table edit all', value: 'datasource.table.edit.*:write' },
  ]

  for (const project of data.value.projects) {
      helpers.push({
        label: `${project.name} view`,
        value: lastTarget(projectPermissionTargets(project.id, 'view', 'read'), `project.view.${project.id}:read`),
      })
      helpers.push({
        label: `${project.name} manage`,
        value: lastTarget(projectPermissionTargets(project.id, 'manage', 'write'), `project.manage.${project.id}:write`),
      })
      helpers.push({
        label: `${project.name} users`,
        value: lastTarget(projectPermissionTargets(project.id, 'users', 'write'), `project.users.${project.id}:write`),
      })

      for (const source of data.value.dataSources.filter((entry) => entry.projectId === project.id)) {
        helpers.push({
          label: `${project.name} / ${source.name} view`,
          value: lastTarget(
            dataSourcePermissionTargets(project.id, source.id, 'view', 'read'),
            `datasource.view.${project.id}.${source.id}:read`,
          ),
        })
        helpers.push({
          label: `${project.name} / ${source.name} query read`,
          value: lastTarget(
            dataSourcePermissionTargets(project.id, source.id, 'query', 'read'),
            `datasource.query.${project.id}.${source.id}:read`,
          ),
        })
        helpers.push({
          label: `${project.name} / ${source.name} query write`,
          value: lastTarget(
            dataSourcePermissionTargets(project.id, source.id, 'query', 'write'),
            `datasource.query.${project.id}.${source.id}:write`,
          ),
        })
        helpers.push({
          label: `${project.name} / ${source.name} manage`,
          value: lastTarget(
            dataSourcePermissionTargets(project.id, source.id, 'manage', 'write'),
            `datasource.manage.${project.id}.${source.id}:write`,
          ),
        })
        helpers.push({
          label: `${project.name} / ${source.name} table edit`,
          value: lastTarget(
            dataSourcePermissionTargets(project.id, source.id, 'table.edit', 'write'),
            `datasource.table.edit.${project.id}.${source.id}:write`,
          ),
        })
      }
  }

  return helpers.filter(
    (helper, index, list) =>
      list.findIndex((entry) => entry.label === helper.label && entry.value === helper.value) === index,
  )
})

const permissionPreview = (permissions: string[]) => permissions.slice(0, 4)

const loadBootstrap = async () => {
  if (!canAccessAdmin.value) {
    return
  }

  loading.value = true
  try {
    const client = await workspaceStore.getClient()
    data.value = await fetchAdminBootstrap(client)
  } finally {
    loading.value = false
  }
}

const saveRole = async (payload: {
  name: string
  slug?: string
  description?: string | null
  permissions: string[]
}) => {
  const editing = editingRole.value

  try {
    const client = await workspaceStore.getClient()
    if (editing) {
      await updateAdminRole(client, editing.id, payload)
    } else {
      await createAdminRole(client, payload)
    }

    roleDialogVisible.value = false
    editingRole.value = null
    await loadBootstrap()
    toast.add({
      severity: 'success',
      summary: editing ? 'Role updated' : 'Role created',
      detail: `${payload.name} is ready`,
      life: 2200,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: editing ? 'Role update failed' : 'Role creation failed',
      detail: getErrorMessage(error, 'The role could not be saved'),
      life: 3200,
    })
  }
}

const saveUser = async (payload: {
  email: string
  name: string
  password?: string
  permissions: string[]
  roleIds: string[]
  disabled: boolean
}) => {
  const editing = editingUser.value

  try {
    const client = await workspaceStore.getClient()
    if (editing) {
      await updateAdminUser(client, editing.id, payload)
    } else {
      if (!payload.password) {
        throw new Error('A password is required for new users')
      }

      await createAdminUser(client, {
        ...payload,
        password: payload.password,
      })
    }

    userDialogVisible.value = false
    editingUser.value = null
    await loadBootstrap()
    toast.add({
      severity: 'success',
      summary: editing ? 'User updated' : 'User created',
      detail: `${payload.name} is ready`,
      life: 2200,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: editing ? 'User update failed' : 'User creation failed',
      detail: getErrorMessage(error, 'The user could not be saved'),
      life: 3200,
    })
  }
}

const removeRole = (role: AdminRoleRecord) => {
  confirm.require({
    header: 'Remove Role',
    message: `Remove role ${role.name}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const client = await workspaceStore.getClient()
        await deleteAdminRole(client, role.id)
        await loadBootstrap()
        toast.add({
          severity: 'success',
          summary: 'Role removed',
          detail: `${role.name} was removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Role removal failed',
          detail: getErrorMessage(error, 'The role could not be removed'),
          life: 3200,
        })
      }
    },
  })
}

const removeUser = (user: AdminUserRecord) => {
  confirm.require({
    header: 'Remove User',
    message: `Remove user ${user.email}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const client = await workspaceStore.getClient()
        await deleteAdminUser(client, user.id)
        await loadBootstrap()
        toast.add({
          severity: 'success',
          summary: 'User removed',
          detail: `${user.email} was removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'User removal failed',
          detail: getErrorMessage(error, 'The user could not be removed'),
          life: 3200,
        })
      }
    },
  })
}

const createApiKey = async (payload: { name: string; expiresInDays?: number | null }) => {
  if (!apiKeyTargetUser.value) {
    return
  }

  try {
    const client = await workspaceStore.getClient()
    const response = await createAdminApiKey(client, apiKeyTargetUser.value.id, payload)
    latestApiKey.value = {
      token: response.token,
      tokenPrefix: response.tokenPrefix,
      userName: apiKeyTargetUser.value.name,
    }
    latestApiKeyDialogVisible.value = true
    apiKeyDialogVisible.value = false
    await loadBootstrap()
    toast.add({
      severity: 'success',
      summary: 'API key created',
      detail: `${payload.name} is ready`,
      life: 2200,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'API key creation failed',
      detail: getErrorMessage(error, 'The API key could not be created'),
      life: 3200,
    })
  }
}

const removeApiKey = (apiKey: AdminApiKeyRecord) => {
  confirm.require({
    header: 'Remove API Key',
    message: `Remove API key ${apiKey.name}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const client = await workspaceStore.getClient()
        await deleteAdminApiKey(client, apiKey.id)
        await loadBootstrap()
        toast.add({
          severity: 'success',
          summary: 'API key removed',
          detail: `${apiKey.name} was removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'API key removal failed',
          detail: getErrorMessage(error, 'The API key could not be removed'),
          life: 3200,
        })
      }
    },
  })
}

const openCreateRoleDialog = () => {
  editingRole.value = null
  roleDialogVisible.value = true
}

const openEditRoleDialog = (role: AdminRoleRecord) => {
  editingRole.value = role
  roleDialogVisible.value = true
}

const openCreateUserDialog = () => {
  editingUser.value = null
  userDialogVisible.value = true
}

const openEditUserDialog = (user: AdminUserRecord) => {
  editingUser.value = user
  userDialogVisible.value = true
}

const openApiKeyDialog = (user: AdminUserRecord) => {
  apiKeyTargetUser.value = user
  apiKeyDialogVisible.value = true
}

const copyLatestApiKey = async () => {
  if (!latestApiKey.value?.token || !navigator.clipboard) {
    return
  }

  await navigator.clipboard.writeText(latestApiKey.value.token)
  toast.add({
    severity: 'success',
    summary: 'Token copied',
    detail: 'The API key token is now in your clipboard',
    life: 1800,
  })
}

onMounted(async () => {
  try {
    await loadBootstrap()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Admin bootstrap failed',
      detail: getErrorMessage(error, 'The admin data could not be loaded'),
      life: 3200,
    })
  }
})
</script>

<template>
  <div class="h-full overflow-auto px-5 py-4">
    <div v-if="!canAccessAdmin" class="max-w-[42rem]">
      <Message severity="warn">
        You do not have access to the admin page on this server.
      </Message>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-6">
        <div>
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Administration</div>
          <h1 class="text-2xl font-semibold mt-1">Users, roles, and API keys</h1>
        </div>

        <Button
          icon="ti ti-refresh"
          label="Refresh"
          severity="secondary"
          :loading="loading"
          @click="loadBootstrap"
        />
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Users</div>
          <div class="text-3xl font-semibold mt-2">{{ data.users.length }}</div>
        </div>
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Roles</div>
          <div class="text-3xl font-semibold mt-2">{{ data.roles.length }}</div>
        </div>
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-4 py-3">
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">API keys</div>
          <div class="text-3xl font-semibold mt-2">{{ data.apiKeys.length }}</div>
        </div>
      </div>

      <section class="mb-8">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 class="text-lg font-semibold">Roles</h2>
            <p class="text-sm opacity-70">Bundle permission patterns into reusable access profiles.</p>
          </div>

          <Button
            v-if="canManageRoles"
            icon="ti ti-plus"
            label="Add role"
            @click="openCreateRoleDialog"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="role of data.roles"
            :key="role.id"
            class="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-4 py-4 flex flex-col gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ role.name }}</h3>
                <div class="mono text-xs opacity-55 mt-1">{{ role.slug }}</div>
              </div>

              <div v-if="canManageRoles" class="flex items-center gap-1">
                <Button
                  icon="ti ti-edit"
                  text
                  rounded
                  severity="secondary"
                  @click="openEditRoleDialog(role)"
                />
                <Button
                  icon="ti ti-trash"
                  text
                  rounded
                  severity="secondary"
                  @click="removeRole(role)"
                />
              </div>
            </div>

            <p class="text-sm opacity-75 min-h-[2.5rem]">
              {{ role.description || 'No description yet.' }}
            </p>

            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="permission of permissionPreview(role.permissions)"
                :key="permission"
                :value="permission"
                severity="secondary"
              />
              <Tag
                v-if="role.permissions.length > 4"
                :value="`+${role.permissions.length - 4} more`"
                severity="contrast"
              />
            </div>
          </div>
        </div>
      </section>

      <section class="mb-8">
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 class="text-lg font-semibold">Users</h2>
            <p class="text-sm opacity-70">Manage local users, direct permissions, and role assignments.</p>
          </div>

          <Button
            v-if="canManageUsers"
            icon="ti ti-user-plus"
            label="Add user"
            @click="openCreateUserDialog"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div
            v-for="user of data.users"
            :key="user.id"
            class="rounded-2xl border border-neutral-200 dark:border-neutral-800 px-4 py-4 flex flex-col gap-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold">{{ user.name }}</h3>
                <div class="text-sm opacity-70">{{ user.email }}</div>
              </div>

              <div class="flex items-center gap-1">
                <Tag
                  :value="user.disabled ? 'Disabled' : user.authProvider === 'openid' ? 'OpenID' : 'Local'"
                  :severity="user.disabled ? 'danger' : 'secondary'"
                />
              </div>
            </div>

            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="roleId of user.roleIds"
                :key="roleId"
                :value="roleNameMap.get(roleId)?.name || roleId"
                severity="info"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="permission of permissionPreview(user.permissions)"
                :key="permission"
                :value="permission"
                severity="secondary"
              />
              <Tag
                v-if="user.permissions.length > 4"
                :value="`+${user.permissions.length - 4} more`"
                severity="contrast"
              />
            </div>

            <div class="flex items-center gap-2 pt-1">
              <Button
                v-if="canManageUsers"
                icon="ti ti-edit"
                label="Edit"
                size="small"
                severity="secondary"
                @click="openEditUserDialog(user)"
              />
              <Button
                v-if="canManageApiKeys"
                icon="ti ti-key"
                label="API key"
                size="small"
                severity="secondary"
                @click="openApiKeyDialog(user)"
              />
              <Button
                v-if="canManageUsers"
                icon="ti ti-trash"
                label="Delete"
                size="small"
                severity="danger"
                text
                @click="removeUser(user)"
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 class="text-lg font-semibold">API Keys</h2>
            <p class="text-sm opacity-70">Use these keys for automation or external provisioning calls.</p>
          </div>
        </div>

        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div
            v-for="apiKey of data.apiKeys"
            :key="apiKey.id"
            class="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b last:border-b-0 border-neutral-200 dark:border-neutral-800 items-center"
          >
            <div>
              <div class="font-medium">{{ apiKey.name }}</div>
              <div class="text-sm opacity-65">
                {{ userNameMap.get(apiKey.userId)?.email || apiKey.userId }}
              </div>
            </div>

            <div class="mono text-sm opacity-70">{{ apiKey.tokenPrefix }}</div>

            <div class="text-sm opacity-70">
              {{ apiKey.expiresAt ? `Expires ${new Date(apiKey.expiresAt).toLocaleString()}` : 'No expiry' }}
            </div>

            <Button
              v-if="canManageApiKeys"
              icon="ti ti-trash"
              text
              rounded
              severity="secondary"
              @click="removeApiKey(apiKey)"
            />
          </div>
        </div>
      </section>
    </template>

    <AdminRoleDialog
      v-model:visible="roleDialogVisible"
      :mode="editingRole ? 'edit' : 'create'"
      :initial-value="editingRole"
      :permission-templates="permissionTemplates"
      @submit="saveRole"
    />
    <AdminUserDialog
      v-model:visible="userDialogVisible"
      :mode="editingUser ? 'edit' : 'create'"
      :initial-value="editingUser"
      :roles="data.roles"
      :permission-templates="permissionTemplates"
      @submit="saveUser"
    />
    <ApiKeyDialog
      v-model:visible="apiKeyDialogVisible"
      :user-name="apiKeyTargetUser?.name"
      @submit="createApiKey"
    />

    <Dialog
      v-model:visible="latestApiKeyDialogVisible"
      modal
      header="API Key Created"
      :style="{ width: '38rem' }"
    >
      <div v-if="latestApiKey" class="flex flex-col gap-4">
        <Message severity="success">
          This token is shown only once for {{ latestApiKey.userName }}.
        </Message>

        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-500/5 px-3 py-3 mono text-sm break-all">
          {{ latestApiKey.token }}
        </div>

        <div class="flex justify-end">
          <Button icon="ti ti-copy" label="Copy token" @click="copyLatestApiKey" />
        </div>
      </div>
    </Dialog>
  </div>
</template>
