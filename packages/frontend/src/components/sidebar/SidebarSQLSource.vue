<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import Button from 'primevue/button'
import ContextMenu, { type ContextMenuMethods } from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import CreateSQLTableDialog from '@/components/sources/database/CreateSQLTableDialog.vue'
import EditSQLTableDialog from '@/components/sources/database/EditSQLTableDialog.vue'
import { getRegisteredDataSourceDefinition } from '@/datasources/registry'
import { dataSourcePermissionTargets, projectPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceRecord } from '@/types/workspace'
import type { SQLQueryTabData, SQLTableTabData } from '@/types/sql'
import { isSqlTableTab } from '@/types/tabs'

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
const tables = ref<Array<{ name: string }>>([])
const selectedTableName = ref<string | null>(null)
const createTableVisible = ref(false)
const editTableVisible = ref(false)

const sourceMenu = useTemplateRef<ContextMenuMethods>('sourceMenu')
const tableMenu = useTemplateRef<ContextMenuMethods>('tableMenu')

const sourceIcon = computed(() => getRegisteredDataSourceDefinition(props.source.type, workspaceStore.serverInfo).icon)
const canQuerySource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission([
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'query', 'read'),
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'query', 'write'),
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
const canEditTables = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission([
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'table.edit', 'write'),
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, props.source.id, 'manage', 'write'),
      ])
    : false,
)
const sourceMenuItems = computed(() => [
  { label: 'Run SQL', icon: 'ti ti-terminal-2', command: openQueryConsole, disabled: !canQuerySource.value },
  {
    label: 'Edit datasource',
    icon: 'ti ti-settings-cog',
    command: () => emit('editDatasource'),
    disabled: !canManageSource.value,
  },
  {
    label: 'Create table',
    icon: 'ti ti-table-plus',
    command: () => (createTableVisible.value = true),
    disabled: !canEditTables.value,
  },
  { label: 'Refresh tables', icon: 'ti ti-refresh', command: loadTables },
  { separator: true },
  {
    label: 'Delete datasource',
    icon: 'ti ti-trash',
    command: deleteDatasource,
    disabled: !canManageSource.value,
  },
])
const tableMenuItems = computed(() => [
  {
    label: 'Open table',
    icon: 'ti ti-table',
    command: () => selectedTableName.value && openTable(selectedTableName.value),
    disabled: !canQuerySource.value,
  },
  {
    label: 'Edit table',
    icon: 'ti ti-edit',
    command: () => selectedTableName.value && (editTableVisible.value = true),
    disabled: !canEditTables.value,
  },
  {
    label: 'Drop table',
    icon: 'ti ti-trash',
    command: () => selectedTableName.value && dropTable(selectedTableName.value),
    disabled: !canEditTables.value,
  },
])

const loadTables = async () => {
  if (!workspaceStore.currentProjectId) return

  isLoading.value = true
  try {
    const client = await workspaceStore.getClient()
    tables.value = (
      await client.get(`/api/projects/${workspaceStore.currentProjectId}/sources/${props.source.id}/tables`)
    ).data
  } finally {
    isLoading.value = false
  }
}

const toggleExpanded = async () => {
  isExpanded.value = !isExpanded.value

  if (isExpanded.value) {
    await loadTables()
  }
}

const openTable = async (tableName: string) => {
  if (!canQuerySource.value) return
  if (!workspaceStore.currentProjectId) return
  const currentServer = await workspaceStore.resolveCurrentServer()
  if (!currentServer) return

  const tabData: SQLTableTabData = {
    serverId: currentServer.id,
    serverUrl: currentServer.url,
    projectId: workspaceStore.currentProjectId,
    sourceId: props.source.id,
    sourceName: props.source.name,
    sourceType: props.source.type,
    tableName,
  }

  tabsStore.openNewTab({
    id: `database.sql.table:${tabData.serverId}:${tabData.projectId}:${tabData.sourceId}:${tableName}`,
    name: tableName,
    type: 'database.sql.table',
    data: tabData,
  })
}

const openQueryConsole = async () => {
  if (!canQuerySource.value) return
  if (!workspaceStore.currentProjectId) return
  const currentServer = await workspaceStore.resolveCurrentServer()
  if (!currentServer) return

  const tabData: SQLQueryTabData = {
    serverId: currentServer.id,
    serverUrl: currentServer.url,
    projectId: workspaceStore.currentProjectId,
    sourceId: props.source.id,
    sourceName: props.source.name,
    sourceType: props.source.type,
  }

  tabsStore.openNewTab({
    id: `database.sql.query:${tabData.serverId}:${tabData.projectId}:${tabData.sourceId}:${Date.now()}`,
    name: `SQL • ${props.source.name}`,
    type: 'database.sql.query',
    data: tabData,
  })
}

const deleteDatasource = async () => {
  if (!canManageSource.value) return
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

const createTable = async (payload: { tableName: string }) => {
  if (!canEditTables.value) return
  createTableVisible.value = false
  await loadTables()
  openTable(payload.tableName)
}

const dropTable = async (tableName: string) => {
  if (!canEditTables.value) return
  if (!workspaceStore.currentProjectId) return

  confirm.require({
    header: 'Drop Table',
    message: `Drop table ${tableName}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      const client = await workspaceStore.getClient()
      await client.delete(`/api/projects/${workspaceStore.currentProjectId}/sources/${props.source.id}/tables/${tableName}`)
      tabsStore.closeTabsMatching(
        (tab) =>
          isSqlTableTab(tab) && tab.data.sourceId === props.source.id && tab.data.tableName === tableName,
      )
      await loadTables()
      toast.add({
        severity: 'success',
        summary: 'Table dropped',
        detail: `${tableName} has been removed`,
        life: 2000,
      })
    },
  })
}

const onTableEdited = async () => {
  await loadTables()
}

const showSourceMenu = (event: MouseEvent) => {
  sourceMenu.value?.show(event)
}

const showTableMenu = (event: MouseEvent, tableName: string) => {
  selectedTableName.value = tableName
  tableMenu.value?.show(event)
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
        icon="ti ti-terminal-2"
        size="small"
        rounded
        text
        severity="secondary"
        class="w-[1.75rem] h-[1.75rem]"
        :disabled="!canQuerySource"
        @click="openQueryConsole"
      />
    </div>

    <div v-if="isExpanded" class="pb-2 px-2">
      <div class="flex flex-col gap-1 pl-5">
        <Button
          v-for="table of tables"
          :key="table.name"
          class="py-1 px-2 flex gap-2 items-center w-full rounded-md pr-1 justify-start"
          text
          severity="secondary"
          size="small"
          :disabled="!canQuerySource"
          @click="openTable(table.name)"
          @contextmenu.prevent="showTableMenu($event, table.name)"
        >
          <i class="ti ti-table" />
          <span class="truncate">{{ table.name }}</span>
        </Button>
      </div>
    </div>

    <ContextMenu
      ref="sourceMenu"
      :model="sourceMenuItems"
    />

    <ContextMenu
      ref="tableMenu"
      :model="tableMenuItems"
    />

    <CreateSQLTableDialog v-model:visible="createTableVisible" :source="source" @applied="createTable" />
    <EditSQLTableDialog
      v-model:visible="editTableVisible"
      :source="source"
      :table-name="selectedTableName"
      @applied="onTableEdited"
    />
  </div>
</template>
