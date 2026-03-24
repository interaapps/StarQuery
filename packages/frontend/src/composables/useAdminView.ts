import { computed, onMounted, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
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
  projectDataSourcePermissionTargets,
  projectPermissionTargets,
} from '@/services/permissions'
import { getErrorMessage } from '@/services/error-message'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import type {
  AdminApiKeyRecord,
  AdminBootstrapPayload,
  AdminRoleRecord,
  AdminUserRecord,
  PermissionTemplate,
} from '@/types/admin'

export function useAdminView() {
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

  const canAccessAdmin = computed(() =>
    authStore.hasPermission(adminPermissionTargets('access', 'read')),
  )
  const canManageRoles = computed(() =>
    authStore.hasPermission(adminPermissionTargets('roles', 'write')),
  )
  const canManageUsers = computed(() =>
    authStore.hasPermission(adminPermissionTargets('users', 'write')),
  )
  const canManageApiKeys = computed(() =>
    authStore.hasPermission(adminPermissionTargets('apiKeys', 'write')),
  )

  const roleNameMap = computed(() => new Map(data.value.roles.map((role) => [role.id, role])))
  const userNameMap = computed(() => new Map(data.value.users.map((user) => [user.id, user])))

  const permissionTemplates = computed<PermissionTemplate[]>(() => {
    const lastTarget = (targets: string[], fallback: string) =>
      targets[targets.length - 1] ?? fallback
    const helpers: PermissionTemplate[] = [
      { label: 'Full access', value: '*' },
      { label: 'Admin access', value: 'admin.*' },
      { label: 'Workspace create', value: 'project.create:write' },
      { label: 'Workspace manage all', value: 'project.manage.*:write' },
      { label: 'Workspace users all', value: 'project.users.*:write' },
      { label: 'Datasource access all (read)', value: 'project.manage.*.datasources.*:read' },
      { label: 'Datasource access all (write)', value: 'project.manage.*.datasources.*:write' },
    ]

    for (const project of data.value.projects) {
      helpers.push({
        label: `${project.name} view`,
        value: lastTarget(
          projectPermissionTargets(project.id, 'view', 'read'),
          `project.view.${project.id}:read`,
        ),
      })
      helpers.push({
        label: `${project.name} manage`,
        value: lastTarget(
          projectPermissionTargets(project.id, 'manage', 'write'),
          `project.manage.${project.id}:write`,
        ),
      })
      helpers.push({
        label: `${project.name} users`,
        value: lastTarget(
          projectPermissionTargets(project.id, 'users', 'write'),
          `project.users.${project.id}:write`,
        ),
      })
      helpers.push({
        label: `${project.name} datasources (read)`,
        value: lastTarget(
          projectDataSourcePermissionTargets(project.id, '*', 'read'),
          `project.manage.${project.id}.datasources.*:read`,
        ),
      })
      helpers.push({
        label: `${project.name} datasources (write)`,
        value: lastTarget(
          projectDataSourcePermissionTargets(project.id, '*', 'write'),
          `project.manage.${project.id}.datasources.*:write`,
        ),
      })

      for (const source of data.value.dataSources.filter((entry) => entry.projectId === project.id)) {
        helpers.push({
          label: `${project.name} / ${source.name} datasource (read)`,
          value: lastTarget(
            projectDataSourcePermissionTargets(project.id, source.id, 'read'),
            `project.manage.${project.id}.datasources.${source.id}:read`,
          ),
        })
        helpers.push({
          label: `${project.name} / ${source.name} datasource (write)`,
          value: lastTarget(
            projectDataSourcePermissionTargets(project.id, source.id, 'write'),
            `project.manage.${project.id}.datasources.${source.id}:write`,
          ),
        })
      }
    }

    return helpers.filter(
      (helper, index, list) =>
        list.findIndex((entry) => entry.label === helper.label && entry.value === helper.value) ===
        index,
    )
  })

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

  const showErrorToast = (summary: string, error: unknown, fallback: string) => {
    toast.add({
      severity: 'error',
      summary,
      detail: getErrorMessage(error, fallback),
      life: 3200,
    })
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
      showErrorToast(
        editing ? 'Role update failed' : 'Role creation failed',
        error,
        'The role could not be saved',
      )
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
      showErrorToast(
        editing ? 'User update failed' : 'User creation failed',
        error,
        'The user could not be saved',
      )
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
          showErrorToast('Role removal failed', error, 'The role could not be removed')
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
          showErrorToast('User removal failed', error, 'The user could not be removed')
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
      showErrorToast('API key creation failed', error, 'The API key could not be created')
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
          showErrorToast('API key removal failed', error, 'The API key could not be removed')
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

  const loadBootstrapWithFeedback = async () => {
    try {
      await loadBootstrap()
    } catch (error) {
      showErrorToast('Admin bootstrap failed', error, 'The admin data could not be loaded')
    }
  }

  onMounted(async () => {
    await loadBootstrapWithFeedback()
  })

  return {
    apiKeyDialogVisible,
    apiKeyTargetUser,
    canAccessAdmin,
    canManageApiKeys,
    canManageRoles,
    canManageUsers,
    copyLatestApiKey,
    createApiKey,
    data,
    editingRole,
    editingUser,
    latestApiKey,
    latestApiKeyDialogVisible,
    loadBootstrap,
    openApiKeyDialog,
    openCreateRoleDialog,
    openCreateUserDialog,
    openEditRoleDialog,
    openEditUserDialog,
    permissionTemplates,
    removeApiKey,
    removeRole,
    removeUser,
    roleDialogVisible,
    roleNameMap,
    saveRole,
    saveUser,
    loading,
    userDialogVisible,
    userNameMap,
  }
}
