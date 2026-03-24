<script lang="ts" setup>
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import ResizeKnob from '@/components/ResizeKnob.vue'
import SidebarResourceSource from '@/components/sidebar/SidebarResourceSource.vue'
import SidebarSQLSource from '@/components/sidebar/SidebarSQLSource.vue'
import CreateDataSourceDialog from '@/components/sidebar/CreateDataSourceDialog.vue'
import { isSqlDataSource } from '@/services/data-source-definitions'
import { getErrorMessage } from '@/services/error-message'
import { dataSourcePermissionTargets, projectPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useToast } from 'primevue/usetoast'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceType } from '@/types/sql'
import type { DataSourceRecord } from '@/types/workspace'

const sidebarWidth = defineModel<number>('sidebarWidth')
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const toast = useToast()

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editingSource = ref<DataSourceRecord | null>(null)
const canCreateDataSource = computed(() =>
  workspaceStore.currentProjectId
    ? authStore.hasPermission([
        ...dataSourcePermissionTargets(workspaceStore.currentProjectId, '*', 'manage', 'write'),
        ...projectPermissionTargets(workspaceStore.currentProjectId, 'manage', 'write'),
      ])
    : false,
)

const openEditDialog = (source: DataSourceRecord) => {
  editingSource.value = source
  editDialogVisible.value = true
}

const createDataSource = async (payload: {
  name: string
  type: DataSourceType
  config: Record<string, unknown>
}) => {
  try {
    await workspaceStore.createDataSource(payload)
    createDialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Datasource created',
      detail: `${payload.name} is ready`,
      life: 2200,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Datasource creation failed',
      detail: getErrorMessage(error, 'The datasource could not be created'),
      life: 3200,
    })
  }
}

const updateDataSource = async (
  sourceId: string,
  payload: {
    name: string
    type: DataSourceType
    config: Record<string, unknown>
  },
) => {
  try {
    await workspaceStore.updateDataSource(sourceId, payload)
    toast.add({
      severity: 'success',
      summary: 'Datasource updated',
      detail: `${payload.name} was saved`,
      life: 2200,
    })
    editDialogVisible.value = false
    editingSource.value = null
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Datasource update failed',
      detail: getErrorMessage(error, 'The datasource could not be updated'),
      life: 3200,
    })
  }
}
</script>

<template>
  <div class="border-r border-neutral-200 dark:border-neutral-800 px-0.5 relative">
    <div class="flex w-full justify-between items-center gap-2 p-2 pb-1 pt-0.5 pr-0">
      <div class="flex flex-col min-w-0 flex-1 region-drag">
        <span class="text-sm opacity-45 truncate max-w-[14rem]">
          {{ workspaceStore.currentProject?.name || 'No project selected' }}
        </span>
      </div>
      <Button
        icon="ti ti-plus text-lg p-0.5"
        size="small"
        rounded
        severity="contrast"
        text
        class="region-no-drag"
        :disabled="!workspaceStore.currentProject || !canCreateDataSource"
        @click="createDialogVisible = true"
      />
    </div>

    <div class="flex flex-col gap-2 px-1">
      <div
        v-if="workspaceStore.serverError"
        class="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
      >
        {{ workspaceStore.serverError }}
      </div>

      <SidebarSQLSource
        v-for="source of workspaceStore.dataSources.filter((source) => isSqlDataSource(source.type, workspaceStore.serverInfo))"
        :key="source.id"
        :source="source"
        @edit-datasource="openEditDialog(source)"
      />
      <SidebarResourceSource
        v-for="source of workspaceStore.dataSources.filter((source) => !isSqlDataSource(source.type, workspaceStore.serverInfo))"
        :key="source.id"
        :source="source"
        @edit-datasource="openEditDialog(source)"
      />
    </div>

    <ResizeKnob
      :min-width="230"
      :max-width="460"
      v-model:width="sidebarWidth"
      class="absolute right-[-0.3rem] top-0"
    />

    <CreateDataSourceDialog v-model:visible="createDialogVisible" @submit="createDataSource" />
    <CreateDataSourceDialog
      v-model:visible="editDialogVisible"
      :source="editingSource"
      @update:visible="(nextVisible) => { if (!nextVisible) editingSource = null }"
      @submit="(payload) => editingSource && updateDataSource(editingSource.id, payload)"
    />
  </div>
</template>
