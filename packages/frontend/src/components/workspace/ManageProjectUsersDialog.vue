<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { getErrorMessage } from '@/services/error-message'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { ProjectRecord, ProjectUserAccess, ProjectUserAccessRecord } from '@/types/workspace'

const visible = defineModel<boolean>('visible', { required: true })
const props = defineProps<{
  project: ProjectRecord | null
}>()

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const toast = useToast()

const loading = ref(false)
const members = ref<ProjectUserAccessRecord[]>([])
const selectedUserId = ref<string | null>(null)
const selectedAccess = ref<ProjectUserAccess>('read')
const savingUserId = ref<string | null>(null)

const accessOptions = [
  { label: 'Read', value: 'read' },
  { label: 'Write', value: 'write' },
] satisfies Array<{ label: string; value: Exclude<ProjectUserAccess, 'none'> }>

const addableUsers = computed(() =>
  [...members.value]
    .filter((user) => user.workspaceAccess === 'none' && !user.disabled)
    .sort((left, right) => `${left.name} ${left.email}`.localeCompare(`${right.name} ${right.email}`)),
)
const activeMembers = computed(() => members.value.filter((user) => user.workspaceAccess !== 'none'))

const loadMembers = async () => {
  if (!props.project || !visible.value) {
    return
  }

  loading.value = true
  try {
    members.value = await workspaceStore.listProjectUsers(props.project.id)
  } catch (error) {
    members.value = []
    toast.add({
      severity: 'error',
      summary: 'Workspace users could not be loaded',
      detail: getErrorMessage(error, 'The server did not return the workspace users.'),
      life: 3200,
    })
  } finally {
    loading.value = false
  }
}

const applyAccess = async (userId: string, access: ProjectUserAccess) => {
  if (!props.project) return

  savingUserId.value = userId
  try {
    const updated = await workspaceStore.updateProjectUserAccess(props.project.id, userId, access)
    const index = members.value.findIndex((user) => user.id === updated.id)
    if (index !== -1) {
      members.value[index] = updated
    }

    if (authStore.currentUser?.id === updated.id) {
      await authStore.refreshStatus()
      await workspaceStore.loadWorkspaceFromServer()
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Workspace access update failed',
      detail: getErrorMessage(error, 'The workspace member could not be updated'),
      life: 3200,
    })
  } finally {
    savingUserId.value = null
  }
}

const addUser = async () => {
  if (!selectedUserId.value) return

  await applyAccess(selectedUserId.value, selectedAccess.value)
  selectedUserId.value = null
  selectedAccess.value = 'read'
}

watch(
  () => visible.value,
  async (nextVisible) => {
    if (!nextVisible) {
      selectedUserId.value = null
      selectedAccess.value = 'read'
      return
    }

    await loadMembers()
  },
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="project ? `Manage Users • ${project.name}` : 'Manage Users'"
    :style="{ width: '44rem' }"
  >
    <div class="flex flex-col gap-4">
      <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-end gap-3">
        <div class="flex-1 flex flex-col gap-2">
          <label class="text-sm opacity-70">Add user</label>
          <Select size="small"
            v-model="selectedUserId"
            :options="addableUsers"
            option-label="email"
            option-value="id"
            filter
            :filter-fields="['name', 'email']"
            fluid
            placeholder="Select a user"
            empty-filter-message="No matching users found"
            empty-message="No available users found"
          >
            <template #option="{ option }">
              <div class="flex flex-col">
                <span>{{ option.name }}</span>
                <span class="text-xs opacity-60">{{ option.email }}</span>
              </div>
            </template>
          </Select>
        </div>

        <div class="w-40 flex flex-col gap-2">
          <label class="text-sm opacity-70">Access</label>
          <Select size="small"
            v-model="selectedAccess"
            :options="accessOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>

        <Button size="small"
          label="Add user"
          icon="ti ti-user-plus"
          :disabled="!selectedUserId"
          @click="addUser"
        />
      </div>

      <div class="flex flex-col gap-2">
        <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono px-1">
          Members
        </div>

        <div
          v-if="loading"
          class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-4 py-6 text-sm opacity-65"
        >
          Loading workspace users...
        </div>

        <div
          v-else-if="!activeMembers.length"
          class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-4 py-6 text-sm opacity-65"
        >
          No workspace users have been assigned yet.
        </div>

        <div v-else class="flex flex-col gap-2">
          <div
            v-for="user of activeMembers"
            :key="user.id"
            class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-3 flex items-center gap-3"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ user.name }}</div>
              <div class="text-sm opacity-65 truncate">{{ user.email }}</div>
            </div>

            <Tag
              v-if="user.roleIds.length"
              :value="user.roles.map((role) => role.name).join(', ')"
              severity="secondary"
            />

            <div class="w-36">
              <Select size="small"
                :model-value="user.workspaceAccess"
                :options="[
                  { label: 'Read', value: 'read' },
                  { label: 'Write', value: 'write' },
                ]"
                option-label="label"
                option-value="value"
                fluid
                :disabled="savingUserId === user.id"
                @update:model-value="(value) => value && applyAccess(user.id, value)"
              />
            </div>

            <Button size="small"
              icon="ti ti-user-minus"
              severity="secondary"
              text
              :loading="savingUserId === user.id"
              @click="applyAccess(user.id, 'none')"
            />
          </div>
        </div>
      </div>
    </div>
  </Dialog>
</template>
