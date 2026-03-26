<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import TabStrip from '@/components/common/TabStrip.vue'
import type { WorkspaceTab } from '@/types/tabs'
import { useAuthStore } from '@/stores/auth-store.ts'
import { adminPermissionTargets } from '@/services/permissions.ts'
import Popover from 'primevue/popover'
import { getErrorMessage } from '@/services/error-message.ts'
import { useToast } from 'primevue/usetoast'
import router from '@/router'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'

const currentTab = defineModel<number>('currentTab', { required: true })

const workspaceStore = useWorkspaceStore()

const authStore = useAuthStore()
const props = defineProps<{
  tabs: WorkspaceTab[]
}>()

const emit = defineEmits<{
  close: [index: number]
  closeOthers: [index: number]
  closeTabsToRight: [index: number]
}>()

const toast = useToast()

function getTabIcon(tab: WorkspaceTab) {
  return {
    'database.sql.query': 'file-type-sql',
    'database.sql.table': 'table',
    'datasource.query': 'terminal-2',
    'datasource.resource.browser': 'folders',
  }[tab.type]
}

const userPopover = ref()
const tabItems = computed(() =>
  props.tabs.map((tab) => ({
    id: tab.id,
    label: tab.name,
    icon: getTabIcon(tab),
    dirty: tab.dirty,
  })),
)

const authButtonTooltip = computed(() => {
  if (!authStore.status.enabled) {
    return null
  }

  if (authStore.currentUser) {
    return authStore.currentUser.email
  }

  return authStore.requiresOnboarding ? 'Create the first admin user' : 'Sign in'
})

const toggleUserPopover = async (event: Event) => {
  if (!authStore.status.enabled) {
    return
  }

  if (!authStore.currentUser) {
    await router.push({ name: authStore.requiresOnboarding ? 'onboarding' : 'login' })
    return
  }

  userPopover.value?.toggle(event)
}

const logout = async () => {
  userPopover.value?.hide()

  try {
    await authStore.logout()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Logout failed',
      detail: getErrorMessage(error, 'The session could not be closed cleanly.'),
      life: 3200,
    })
  }
}
</script>

<template>
  <div class="app-border flex min-w-0" :class="props.tabs.length ? 'border-b' : ''">
    <TabStrip
      v-model:current-tab="currentTab"
      :tabs="tabItems"
      root-class="flex-1"
      @close="emit('close', $event)"
      @close-others="emit('closeOthers', $event)"
      @close-tabs-to-right="emit('closeTabsToRight', $event)"
    />
    <div
      class="flex justify-end items-center px-1 -space-x-1 opacity-30 hover:opacity-100 transition-all"
    >
      <!-- TODO Settings -->
      <Button
        class="opacity-0 region-drag cursor-default"
        icon="ti ti-settings"
        severity="secondary"
        rounded
        text
        size="small"
      />

      <template v-if="authStore.status.enabled">
        <Button
          v-if="authStore.currentUser"
          v-tooltip="authButtonTooltip || undefined"
          :icon="`ti ${authStore.currentUser ? 'ti-user' : 'ti-lock'}`"
          severity="secondary"
          rounded
          text
          size="small"
          @click="toggleUserPopover"
        />

        <Button
          v-else
          label="Login"
          size="small"
          class="p-0.5 px-2"
          as="router-link"
          :to="{ name: authStore.requiresOnboarding ? 'onboarding' : 'login' }"
        />
      </template>

      <Popover v-if="authStore.status.enabled && authStore.currentUser" ref="userPopover">
        <div class="w-[18rem] flex flex-col gap-3">
          <div>
            <div class="font-semibold">{{ authStore.currentUser.name }}</div>
            <div class="text-sm opacity-70">{{ authStore.currentUser.email }}</div>
          </div>

          <div class="rounded-xl border app-border px-3 py-2 text-xs opacity-70">
            {{ workspaceStore.currentServer?.name || 'Current server' }}
          </div>

          <Button
            size="small"
            v-if="authStore.hasPermission(adminPermissionTargets('access', 'read'))"
            label="Admin page"
            icon="ti ti-shield"
            severity="secondary"
            text
            class="justify-start"
            as="router-link"
            :to="{ name: 'admin' }"
          />
          <Button
            size="small"
            label="Sign out"
            icon="ti ti-logout-2"
            severity="secondary"
            text
            class="justify-start"
            @click="logout"
          />
        </div>
      </Popover>
    </div>
  </div>
</template>
