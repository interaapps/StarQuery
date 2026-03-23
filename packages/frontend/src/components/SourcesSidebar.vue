<script lang="ts" setup>
import { ref } from 'vue'
import Button from 'primevue/button'
import ResizeKnob from '@/components/ResizeKnob.vue'
import SidebarSQLSource from '@/components/sidebar/SidebarSQLSource.vue'
import CreateDataSourceDialog from '@/components/sidebar/CreateDataSourceDialog.vue'
import { getErrorMessage } from '@/services/error-message'
import { useToast } from 'primevue/usetoast'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceType } from '@/types/sql'

const sidebarWidth = defineModel<number>('sidebarWidth')
const workspaceStore = useWorkspaceStore()
const toast = useToast()

const createDialogVisible = ref(false)

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
        :disabled="!workspaceStore.currentProject"
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
        v-for="source of workspaceStore.dataSources"
        :key="source.id"
        :source="source"
      />
    </div>

    <ResizeKnob
      :min-width="230"
      :max-width="460"
      v-model:width="sidebarWidth"
      class="absolute right-[-0.3rem] top-0"
    />

    <CreateDataSourceDialog v-model:visible="createDialogVisible" @submit="createDataSource" />
  </div>
</template>
