<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import AdminApiKeyRevealDialog from '@/components/admin/AdminApiKeyRevealDialog.vue'
import AdminApiKeysSection from '@/components/admin/AdminApiKeysSection.vue'
import AdminRoleDialog from '@/components/admin/AdminRoleDialog.vue'
import AdminRolesSection from '@/components/admin/AdminRolesSection.vue'
import AdminStatsGrid from '@/components/admin/AdminStatsGrid.vue'
import AdminUserDialog from '@/components/admin/AdminUserDialog.vue'
import AdminUsersSection from '@/components/admin/AdminUsersSection.vue'
import ApiKeyDialog from '@/components/admin/ApiKeyDialog.vue'
import { useAdminView } from '@/composables/useAdminView'

const {
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
  loading,
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
  saveRole,
  saveUser,
  userDialogVisible,
} = useAdminView()
</script>

<template>
  <div class="h-full overflow-auto px-5 py-4">
    <div v-if="!canAccessAdmin" class="max-w-[42rem]">
      <Message severity="warn"> You do not have access to the admin page on this server. </Message>
    </div>

    <template v-else>
      <div class="flex items-center justify-between gap-3 mb-6">
        <div>
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Administration</div>
          <h1 class="text-2xl font-semibold mt-1">Users, roles, and API keys</h1>
        </div>

        <Button
          size="small"
          icon="ti ti-refresh"
          label="Refresh"
          severity="secondary"
          :loading="loading"
          @click="loadBootstrap"
        />
      </div>

      <AdminStatsGrid
        :users-count="data.users.length"
        :roles-count="data.roles.length"
        :api-keys-count="data.apiKeys.length"
      />

      <AdminRolesSection
        :roles="data.roles"
        :can-manage-roles="canManageRoles"
        @create="openCreateRoleDialog"
        @edit="openEditRoleDialog"
        @remove="removeRole"
      />

      <AdminUsersSection
        :users="data.users"
        :roles="data.roles"
        :can-manage-users="canManageUsers"
        :can-manage-api-keys="canManageApiKeys"
        @create="openCreateUserDialog"
        @edit="openEditUserDialog"
        @remove="removeUser"
        @create-api-key="openApiKeyDialog"
      />

      <AdminApiKeysSection
        :api-keys="data.apiKeys"
        :users="data.users"
        :can-manage-api-keys="canManageApiKeys"
        @remove="removeApiKey"
      />
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
    <AdminApiKeyRevealDialog
      v-model:visible="latestApiKeyDialogVisible"
      :api-key="latestApiKey"
      @copy="copyLatestApiKey"
    />
  </div>
</template>
