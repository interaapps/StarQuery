<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { AdminRoleRecord } from '@/types/admin'

defineProps<{
  roles: AdminRoleRecord[]
  canManageRoles: boolean
}>()

defineEmits<{
  create: []
  edit: [role: AdminRoleRecord]
  remove: [role: AdminRoleRecord]
}>()

function previewPermissions(permissions: string[]) {
  return permissions.slice(0, 4)
}
</script>

<template>
  <section class="mb-8">
    <div class="flex items-center justify-between gap-3 mb-3">
      <div>
        <h2 class="text-lg font-semibold">Roles</h2>
        <p class="text-sm opacity-70">
          Bundle permission patterns into reusable access profiles.
        </p>
      </div>

      <Button
        v-if="canManageRoles"
        size="small"
        icon="ti ti-plus"
        label="Add role"
        @click="$emit('create')"
      />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      <div
        v-for="role of roles"
        :key="role.id"
        class="rounded-2xl border app-border px-4 py-4 flex flex-col gap-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">{{ role.name }}</h3>
            <div class="mono text-xs opacity-55 mt-1">{{ role.slug }}</div>
          </div>

          <div v-if="canManageRoles" class="flex items-center gap-1">
            <Button
              size="small"
              icon="ti ti-edit"
              text
              rounded
              severity="secondary"
              @click="$emit('edit', role)"
            />
            <Button
              size="small"
              icon="ti ti-trash"
              text
              rounded
              severity="secondary"
              @click="$emit('remove', role)"
            />
          </div>
        </div>

        <p class="text-sm opacity-75 min-h-[2.5rem]">
          {{ role.description || 'No description yet.' }}
        </p>

        <div class="flex flex-wrap gap-2">
          <Tag
            v-for="permission of previewPermissions(role.permissions)"
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
</template>
