<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import Button from 'primevue/button'
import ContextMenu, { type ContextMenuMethods } from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import { loadDataSourceResources } from '@/services/data-source-browser'
import { getDataSourceDefinition } from '@/services/data-source-definitions'
import { getErrorMessage } from '@/services/error-message'
import { dataSourcePermissionTargets, projectPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceBrowserTabData, DataSourceResourceItem } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'

const props = defineProps<{
  source: DataSourceRecord
}>()

const emit = defineEmits<{
  editDatasource: []
}>()

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const tabsStore = useTabsStore()
const confirm = useConfirm()
const toast = useToast()

const isExpanded = ref(false)
const isLoading = ref(false)
const items = ref<DataSourceResourceItem[]>([])
const selectedItem = ref<DataSourceResourceItem | null>(null)
const sourceMenu = useTemplateRef<ContextMenuMethods>('sourceMenu')
const itemMenu = useTemplateRef<ContextMenuMethods>('itemMenu')

const sourceDefinition = computed(() => getDataSourceDefinition(props.source.type, workspaceStore.serverInfo))
const sourceIcon = computed(() => sourceDefinition.value.icon)
const defaultBrowserPath = computed(() => {
  if (props.source.type !== 's3' && props.source.type !== 'minio') {
    return ''
  }

  const bucket = props.source.config?.bucket
  return typeof bucket === 'string' && bucket.trim() ? `${bucket.trim().replace(/^\/+|\/+$/g, '')}/` : ''
})
const canBrowseSource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission([
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'view', 'read'),
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'query', 'read'),
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'manage', 'write'),
      ])
    : false,
)
const canManageSource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission([
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'manage', 'write'),
        ...projectPermissionTargets(workspaceStore.currentProjectId, 'manage', 'write'),
      ])
    : false,
)

async function loadItems() {
  if (!workspaceStore.currentProjectId) {
    return
  }

  isLoading.value = true
  try {
    const client = await workspaceStore.getClient()
    const listing = await loadDataSourceResources({
      client,
      projectId: workspaceStore.currentProjectId,
      sourceId: props.source.id,
    })
    items.value = listing.items
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Datasource load failed',
      detail: getErrorMessage(error, 'The datasource resources could not be loaded'),
      life: 3200,
    })
  } finally {
    isLoading.value = false
  }
}

async function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    await loadItems()
  }
}

async function openBrowser(path = defaultBrowserPath.value) {
  if (!canBrowseSource.value || !workspaceStore.currentProjectId) {
    return
  }

  const currentServer = await workspaceStore.resolveCurrentServer()
  if (!currentServer) {
    return
  }

  const tabData: DataSourceBrowserTabData = {
    serverId: currentServer.id,
    serverUrl: currentServer.url,
    projectId: workspaceStore.currentProjectId,
    sourceId: props.source.id,
    sourceName: props.source.name,
    sourceType: props.source.type,
    path,
  }

  tabsStore.openNewTab({
    id: `datasource.resource.browser:${tabData.serverId}:${tabData.projectId}:${tabData.sourceId}:${path}`,
    name: path ? `${props.source.name} • ${path}` : props.source.name,
    type: 'datasource.resource.browser',
    data: tabData,
  })
}

async function deleteDatasource() {
  if (!canManageSource.value) {
    return
  }

  confirm.require({
    header: 'Delete Datasource',
    message: `Delete datasource ${props.source.name}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      await workspaceStore.deleteDataSource(props.source.id)
      tabsStore.closeTabsMatching((tab) => tab.data?.sourceId === props.source.id)
      toast.add({
        severity: 'success',
        summary: 'Datasource deleted',
        detail: `${props.source.name} has been removed`,
        life: 2000,
      })
    },
  })
}

const sourceMenuItems = computed(() => [
  {
    label: 'Open browser',
    icon: 'ti ti-folder-open',
    command: () => openBrowser(),
    disabled: !canBrowseSource.value,
  },
  {
    label: 'Edit datasource',
    icon: 'ti ti-settings-cog',
    command: () => emit('editDatasource'),
    disabled: !canManageSource.value,
  },
  {
    label: 'Refresh resources',
    icon: 'ti ti-refresh',
    command: loadItems,
  },
  { separator: true },
  {
    label: 'Delete datasource',
    icon: 'ti ti-trash',
    command: deleteDatasource,
    disabled: !canManageSource.value,
  },
])

const itemMenuItems = computed(() => [
  {
    label: selectedItem.value?.kind === 'container' ? 'Open' : 'Preview',
    icon: selectedItem.value?.kind === 'container' ? 'ti ti-folder-open' : 'ti ti-file-search',
    command: () => selectedItem.value && openBrowser(selectedItem.value.path),
    disabled: !canBrowseSource.value,
  },
])

function showSourceMenu(event: MouseEvent) {
  sourceMenu.value?.show(event)
}

function showItemMenu(event: MouseEvent, item: DataSourceResourceItem) {
  selectedItem.value = item
  itemMenu.value?.show(event)
}
</script>

<template>
  <div class="rounded-xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors">
    <div class="flex items-center justify-between gap-2 px-2 py-1.5">
      <Button
        class="py-1 px-2 flex gap-2 items-center justify-between flex-1 rounded-md pr-1"
        text
        severity="secondary"
        @click="toggleExpanded"
        @contextmenu.prevent="showSourceMenu"
        size="small"
      >
        <div class="flex gap-2 items-center">
          <LogoLoadingSpinner v-if="isLoading" width="1rem" />
          <i v-else :class="`ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'}`" />
          <i :class="`ti ti-${sourceIcon}`" />
          <span class="truncate">{{ source.name }}</span>
        </div>
      </Button>

      <Button
        icon="ti ti-folder-open"
        size="small"
        rounded
        text
        severity="secondary"
        class="w-[1.75rem] h-[1.75rem]"
        :disabled="!canBrowseSource"
        @click="openBrowser()"
      />
    </div>

    <div v-if="isExpanded" class="pb-2 px-2">
      <div class="flex flex-col gap-1 pl-5">
        <Button
          v-for="item of items"
          :key="item.id"
          class="py-1 px-2 flex gap-2 items-center w-full rounded-md pr-1 justify-start"
          text
          severity="secondary"
          size="small"
          :disabled="!canBrowseSource"
          @click="openBrowser(item.path)"
          @contextmenu.prevent="showItemMenu($event, item)"
        >
          <i :class="`ti ${item.kind === 'container' ? 'ti-folder' : 'ti-file'}`" />
          <span class="truncate">{{ item.name }}</span>
        </Button>
      </div>
    </div>

    <ContextMenu ref="sourceMenu" :model="sourceMenuItems" />
    <ContextMenu ref="itemMenu" :model="itemMenuItems" />
  </div>
</template>
