<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { AdminRoleRecord, AdminUserRecord } from '@/types/admin'

const props = defineProps<{
  users: AdminUserRecord[]
  roles: AdminRoleRecord[]
  canManageUsers: boolean
  canManageApiKeys: boolean
}>()

defineEmits<{
  create: []
  edit: [user: AdminUserRecord]
  remove: [user: AdminUserRecord]
  createApiKey: [user: AdminUserRecord]
}>()

const roleNameMap = computed(() => new Map(props.roles.map((role) => [role.id, role.name])))

function previewPermissions(permissions: string[]) {
  return permissions.slice(0, 4)
}
</script>

<template>
  <section class="mb-8">
    <div class="flex items-center justify-between gap-3 mb-3">
      <div>
        <h2 class="text-lg font-semibold">Users</h2>
        <p class="text-sm opacity-70">
          Manage local users, direct permissions, and role assignments.
        </p>
      </div>

      <Button
        v-if="canManageUsers"
        size="small"
        icon="ti ti-user-plus"
        label="Add user"
        @click="$emit('create')"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      <div
        v-for="user of users"
        :key="user.id"
        class="rounded-2xl border app-border px-4 py-4 flex flex-col gap-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">{{ user.name }}</h3>
            <div class="text-sm opacity-70">{{ user.email }}</div>
          </div>

          <Tag
            :value="
              user.disabled ? 'Disabled' : user.authProvider === 'openid' ? 'OpenID' : 'Local'
            "
            :severity="user.disabled ? 'danger' : 'secondary'"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="roleId of user.roleIds"
            :key="roleId"
            :value="roleNameMap.get(roleId) || roleId"
            severity="info"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="permission of previewPermissions(user.permissions)"
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
            @click="$emit('edit', user)"
          />
          <Button
            v-if="canManageApiKeys"
            icon="ti ti-key"
            label="API key"
            size="small"
            severity="secondary"
            @click="$emit('createApiKey', user)"
          />
          <Button
            v-if="canManageUsers"
            icon="ti ti-trash"
            label="Delete"
            size="small"
            severity="danger"
            text
            @click="$emit('remove', user)"
          />
        </div>
      </div>
    </div>
  </section>
</template>
