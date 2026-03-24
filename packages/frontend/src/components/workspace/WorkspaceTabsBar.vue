<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import Button from 'primevue/button'
import ContextMenu, { type ContextMenuMethods } from 'primevue/contextmenu'
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

const tabsScroller = useTemplateRef<HTMLDivElement>('tabsScroller')
const tabMenu = useTemplateRef<ContextMenuMethods>('tabMenu')
const selectedTabIndex = ref<number | null>(null)

const toast = useToast()

function getTabIcon(tab: WorkspaceTab) {
  return {
    'database.sql.query': 'file-type-sql',
    'database.sql.table': 'table',
    'datasource.resource.browser': 'folders',
  }[tab.type]
}

function scrollActiveTabIntoView() {
  nextTick(() => {
    const scroller = tabsScroller.value
    if (!scroller) {
      return
    }

    const activeTab = scroller.querySelector<HTMLElement>(`[data-tab-index="${currentTab.value}"]`)
    activeTab?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  })
}

const userPopover = ref()
watch(
  () => [currentTab.value, props.tabs.length],
  () => {
    scrollActiveTabIntoView()
  },
  { immediate: true },
)

const selectedTab = computed(() =>
  selectedTabIndex.value == null ? null : (props.tabs[selectedTabIndex.value] ?? null),
)

const canCloseOthers = computed(() => selectedTabIndex.value != null && props.tabs.length > 1)
const canCloseTabsToRight = computed(
  () =>
    selectedTabIndex.value != null &&
    selectedTabIndex.value >= 0 &&
    selectedTabIndex.value < props.tabs.length - 1,
)

const tabMenuItems = computed(() => [
  {
    label: selectedTab.value ? `Close ${selectedTab.value.name}` : 'Close tab',
    icon: 'ti ti-x',
    command: () => {
      if (selectedTabIndex.value != null) {
        emit('close', selectedTabIndex.value)
      }
    },
    disabled: selectedTabIndex.value == null,
  },
  {
    label: 'Close other tabs',
    icon: 'ti ti-layout-kanban',
    command: () => {
      if (selectedTabIndex.value != null) {
        emit('closeOthers', selectedTabIndex.value)
      }
    },
    disabled: !canCloseOthers.value,
  },
  {
    label: 'Close tabs to the right',
    icon: 'ti ti-arrow-right-bar',
    command: () => {
      if (selectedTabIndex.value != null) {
        emit('closeTabsToRight', selectedTabIndex.value)
      }
    },
    disabled: !canCloseTabsToRight.value,
  },
])

function handleAuxClick(event: MouseEvent, index: number) {
  if (event.button !== 1) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  emit('close', index)
}

function showTabMenu(event: MouseEvent, index: number) {
  selectedTabIndex.value = index
  tabMenu.value?.show(event)
}

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
  <div
    class="border-neutral-200 dark:border-neutral-800 flex min-w-0"
    :class="props.tabs.length ? 'border-b' : ''"
  >
    <div
      ref="tabsScroller"
      class="flex-1 w-full min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap tabs-scroll region-drag"
    >
      <div class="flex min-w-max">
        <div
          v-for="(tab, index) of props.tabs"
          :key="tab.id ?? `${tab.type}:${index}`"
          :data-tab-index="index"
          class="group flex flex-none min-w-[11rem] max-w-[18rem] items-center gap-1 border-r border-neutral-200 px-2 py-1.5 transition-colors dark:border-neutral-800 region-no-drag"
          :class="
            currentTab === index
              ? 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
              : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80'
          "
          @auxclick="handleAuxClick($event, index)"
          @contextmenu.prevent="showTabMenu($event, index)"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            @click="currentTab = index"
          >
            <i :class="`ti ti-${getTabIcon(tab)} flex-none text-sm`" />
            <span class="truncate min-w-0 max-w-[15rem] text-sm">{{ tab.name }}</span>
            <span
              v-if="tab.dirty"
              class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block flex-none"
            />
          </button>
          <Button
            rounded
            icon="ti ti-x"
            text
            size="small"
            class="h-5 w-5 flex-none p-0 region-no-drag opacity-0 transition-opacity group-hover:opacity-100"
            :class="currentTab === index ? 'opacity-100' : ''"
            @click.stop="emit('close', index)"
          />
        </div>
      </div>
    </div>
    <div
      class="flex justify-end items-center px-1 -space-x-1 opacity-30 hover:opacity-100 transition-all"
    >
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

          <div
            class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs opacity-70"
          >
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

      <!-- TODO Settings -->
      <Button
        class="opacity-0 region-drag cursor-default"
        icon="ti ti-settings"
        severity="secondary"
        rounded
        text
        size="small"
      />
    </div>
    <ContextMenu ref="tabMenu" :model="tabMenuItems" class="text-sm" />
  </div>
</template>

<style scoped>
.tabs-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-scroll::-webkit-scrollbar {
  display: none;
}
</style>
