<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import ContextMenu, { type ContextMenuMethods } from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import SidebarSourceItemButton from '@/components/sidebar/source/SidebarSourceItemButton.vue'
import SidebarSourceSection from '@/components/sidebar/source/SidebarSourceSection.vue'
import { getRegisteredDataSourceDefinition, supportsQueryConsole } from '@/datasources/registry'
import { loadDataSourceResources } from '@/datasources/shared-resource/browser'
import { getErrorMessage } from '@/services/error-message'
import {
  dataSourceConfigPermissionTargets,
  dataSourceReadPermissionTargets,
} from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceBrowserTabData, DataSourceResourceItem } from '@/types/datasources'
import type { DataSourceQueryTabData } from '@/types/query-console'
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

const sourceDefinition = computed(() =>
  getRegisteredDataSourceDefinition(props.source.type, workspaceStore.serverInfo),
)
const sourceIcon = computed(() => sourceDefinition.value.icon)
const defaultBrowserPath = computed(() => {
  if (props.source.type === 'mongodb') {
    const database = props.source.config?.database
    return typeof database === 'string' && database.trim()
      ? database.trim().replace(/^\/+|\/+$/g, '')
      : ''
  }

  if (props.source.type === 's3' || props.source.type === 'minio') {
    const bucket = props.source.config?.bucket
    return typeof bucket === 'string' && bucket.trim()
      ? `${bucket.trim().replace(/^\/+|\/+$/g, '')}/`
      : ''
  }

  return ''
})
const canBrowseSource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission(
        dataSourceReadPermissionTargets(workspaceStore.currentProjectId, props.source.id),
      )
    : false,
)
const canQuerySource = computed(
  () => supportsQueryConsole(props.source.type, workspaceStore.serverInfo) && canBrowseSource.value,
)
const canManageSource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission(
        dataSourceConfigPermissionTargets(workspaceStore.currentProjectId, props.source.id),
      )
    : false,
)
const primaryActionIcon = computed(() =>
  canQuerySource.value ? 'ti ti-terminal-2' : 'ti ti-folder-open',
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
      ...(props.source.type === 'mongodb' && defaultBrowserPath.value
        ? { path: defaultBrowserPath.value }
        : {}),
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

async function openQueryConsole() {
  if (!canQuerySource.value || !workspaceStore.currentProjectId) {
    return
  }

  const currentServer = await workspaceStore.resolveCurrentServer()
  if (!currentServer) {
    return
  }

  let tabData: DataSourceQueryTabData | null = null

  if (props.source.type === 'redis') {
    tabData = {
      serverId: currentServer.id,
      serverUrl: currentServer.url,
      projectId: workspaceStore.currentProjectId,
      sourceId: props.source.id,
      sourceName: props.source.name,
      sourceType: 'redis',
    }
  }

  if (props.source.type === 'convex') {
    tabData = {
      serverId: currentServer.id,
      serverUrl: currentServer.url,
      projectId: workspaceStore.currentProjectId,
      sourceId: props.source.id,
      sourceName: props.source.name,
      sourceType: 'convex',
    }
  }

  if (!tabData) {
    return
  }

  tabsStore.openNewTab({
    id: tabsStore.createTransientTabId(
      `datasource.query:${tabData.serverId}:${tabData.projectId}:${tabData.sourceId}:${tabData.sourceType}`,
    ),
    name: `${sourceDefinition.value.label} • ${props.source.name}`,
    type: 'datasource.query',
    data: tabData,
  })
}

async function runPrimaryAction() {
  if (canQuerySource.value) {
    await openQueryConsole()
    return
  }

  await openBrowser()
}

const sourceMenuItems = computed(() => [
  ...(canQuerySource.value
    ? [
        {
          label: 'Open console',
          icon: 'ti ti-terminal-2',
          command: () => openQueryConsole(),
          disabled: !canQuerySource.value,
        },
      ]
    : []),
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

function getItemIcon(item: DataSourceResourceItem) {
  if (props.source.type === 'convex' && item.kind === 'container') {
    return 'ti ti-table'
  }

  return `ti ${item.kind === 'container' ? 'ti-folder' : 'ti-file'}`
}
</script>

<template>
  <SidebarSourceSection
    v-model:expanded="isExpanded"
    :loading="isLoading"
    :source-icon="sourceIcon"
    :name="source.name"
    :action-icon="primaryActionIcon"
    :action-disabled="!canBrowseSource && !canQuerySource"
    @toggle="toggleExpanded"
    @action="runPrimaryAction()"
    @source-contextmenu="showSourceMenu"
  >
    <template #items>
      <SidebarSourceItemButton
        v-for="item of items"
        :key="item.id"
        :icon="getItemIcon(item)"
        :label="item.name"
        :disabled="!canBrowseSource"
        @click="openBrowser(item.path)"
        @contextmenu="showItemMenu($event, item)"
      />
    </template>

    <template #overlay>
      <ContextMenu ref="sourceMenu" :model="sourceMenuItems" />
      <ContextMenu ref="itemMenu" :model="itemMenuItems" />
    </template>
  </SidebarSourceSection>
</template>
