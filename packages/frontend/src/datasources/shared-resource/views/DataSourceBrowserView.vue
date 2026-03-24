<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Breadcrumb from 'primevue/breadcrumb'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { loadDataSourceResources } from '@/datasources/shared-resource/browser'
import { getErrorMessage } from '@/services/error-message'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceBrowserTabData, DataSourceResourceItem, DataSourceResourceListing } from '@/types/datasources'

const props = defineProps<{
  data: DataSourceBrowserTabData
}>()

const workspaceStore = useWorkspaceStore()
const toast = useToast()
const isLoading = ref(false)
const listing = ref<DataSourceResourceListing | null>(null)
const currentPath = ref(props.data.path ?? '')

const breadcrumbItems = computed(() => {
  const segments = currentPath.value.split('/').filter(Boolean)
  const items = [{ label: props.data.sourceName, command: () => navigateTo('') }]
  let path = ''

  segments.forEach((segment, index) => {
    path = path ? `${path}/${segment}` : segment
    const isContainer = listing.value?.path.endsWith('/') || index < segments.length - 1
    items.push({
      label: segment,
      command: () => navigateTo(isContainer ? `${path}/` : path),
    })
  })

  return items
})

const previewJson = computed(() =>
  listing.value?.preview?.type === 'json' ? JSON.stringify(listing.value.preview.value, null, 2) : null,
)

async function loadListing(path = currentPath.value) {
  isLoading.value = true
  try {
    const client = await workspaceStore.getClient()
    listing.value = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path,
    })
    currentPath.value = listing.value.path
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

function navigateTo(path: string) {
  void loadListing(path)
}

function openItem(item: DataSourceResourceItem) {
  navigateTo(item.path)
}

onMounted(() => {
  void loadListing(currentPath.value)
})

watch(
  () => props.data.path,
  (nextPath) => {
    currentPath.value = nextPath ?? ''
    void loadListing(currentPath.value)
  },
)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="border-b app-border px-4 py-2 flex items-center gap-3">
      <Breadcrumb :home="{ icon: 'ti ti-home', command: () => navigateTo('') }" :model="breadcrumbItems" />
      <div class="ml-auto">
        <Button size="small" icon="ti ti-refresh" text severity="secondary" @click="navigateTo(currentPath)" />
      </div>
    </div>

    <div class="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
      <div class="min-h-0 border-r app-border">
        <DataTable
          :value="listing?.items ?? []"
          :loading="isLoading"
          data-key="id"
          scrollable
          scroll-height="flex"
          class="h-full"
        >
          <Column header="" style="width: 3rem">
            <template #body="{ data }">
              <i :class="`ti ${data.kind === 'container' ? 'ti-folder' : 'ti-file'}`" />
            </template>
          </Column>
          <Column field="name" header="Name">
            <template #body="{ data }">
              <button class="text-left hover:text-primary-500" @click="openItem(data)">
                {{ data.name }}
              </button>
            </template>
          </Column>
          <Column field="description" header="Description" />
          <Column header="Type" style="width: 7rem">
            <template #body="{ data }">
              <Tag :value="data.kind" severity="secondary" />
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="min-h-0 overflow-auto p-4">
        <div v-if="!listing?.preview" class="text-sm opacity-60">No preview for this selection yet.</div>

        <template v-else-if="listing.preview.type === 'json'">
          <div class="text-sm font-semibold mb-2">{{ listing.preview.title }}</div>
          <pre class="text-xs rounded-xl bg-neutral-100 dark:bg-neutral-900 p-3 overflow-auto">{{ previewJson }}</pre>
        </template>

        <template v-else-if="listing.preview.type === 'text'">
          <div class="text-sm font-semibold mb-2">{{ listing.preview.title }}</div>
          <pre class="text-xs rounded-xl bg-neutral-100 dark:bg-neutral-900 p-3 overflow-auto">{{ listing.preview.text }}</pre>
        </template>

        <template v-else-if="listing.preview.type === 'table'">
          <div class="text-sm font-semibold mb-2">{{ listing.preview.title }}</div>
          <DataTable :value="listing.preview.rows" size="small">
            <Column v-for="column of listing.preview.columns" :key="column" :field="column" :header="column" />
          </DataTable>
        </template>
      </div>
    </div>
  </div>
</template>
