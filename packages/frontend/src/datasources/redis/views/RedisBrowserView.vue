<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import GenericTableView from '@/datasources/shared/components/GenericTableView.vue'
import { buildRedisListingTable, buildRedisPreviewTable } from '@/datasources/redis/browser'
import { loadDataSourceResources } from '@/datasources/shared-resource/browser'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourceReadPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import type {
  DataSourceBrowserTabData,
  DataSourceResourceItem,
  DataSourceResourceListing,
} from '@/types/datasources'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = defineProps<{
  data: DataSourceBrowserTabData
}>()

const authStore = useAuthStore()
const client = createBackendClient(props.data.serverUrl)

const listing = ref<DataSourceResourceListing | null>(null)
const searchInput = ref('')
const appliedSearch = ref('')
const currentPath = ref(props.data.path ?? '')
const isLoading = ref(false)
const logs = ref<SQLActivityEntry[]>([])
const columns = ref<SQLTableColumn[]>([])
const rows = ref<SQLTableRowDraft[]>([])
const focusedRowIndex = ref<number | null>(null)

const canBrowse = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const isPreviewMode = computed(() => Boolean(currentPath.value))
const selectedItem = computed<DataSourceResourceItem | null>(() => {
  if (isPreviewMode.value || focusedRowIndex.value === null) {
    return null
  }

  return listing.value?.items[focusedRowIndex.value] ?? null
})
const detailEntries = computed(() =>
  Object.entries(listing.value?.details?.metadata ?? {}).map(([label, value]) => ({
    label,
    value: String(value),
  })),
)
const previewTitle = computed(
  () => listing.value?.preview?.title ?? listing.value?.details?.name ?? 'Redis Preview',
)
const statusMessage = computed(() => {
  if (isPreviewMode.value) {
    return previewTitle.value
  }

  if (appliedSearch.value) {
    return `Match: ${appliedSearch.value}`
  }

  if (listing.value?.page?.hasMore) {
    return `${listing.value.items.length} key(s) loaded, more available`
  }

  if (listing.value) {
    return `${listing.value.items.length} key(s) loaded`
  }

  return null
})
const fileBaseName = computed(() => {
  const suffix = currentPath.value || appliedSearch.value || 'keys'
  return `${props.data.sourceName}-${suffix}`
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
})

function pushLog(entry: Omit<SQLActivityEntry, 'id'>) {
  logs.value = [
    {
      id: `${entry.level}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...entry,
    },
    ...logs.value,
  ].slice(0, 20)
}

function syncTableState() {
  focusedRowIndex.value = null

  if (!listing.value) {
    columns.value = []
    rows.value = []
    return
  }

  const tableData = isPreviewMode.value
    ? buildRedisPreviewTable(listing.value)
    : buildRedisListingTable(listing.value)

  columns.value = tableData.columns
  rows.value = tableData.rows
}

async function loadRedisData(options?: { path?: string; search?: string }) {
  if (!canBrowse.value) {
    listing.value = null
    columns.value = []
    rows.value = []
    pushLog({
      level: 'error',
      title: 'Permission required',
      message: 'This server account can open the datasource but cannot load Redis keys.',
    })
    return
  }

  const nextPath = options?.path ?? currentPath.value
  const nextSearch = nextPath ? '' : (options?.search ?? appliedSearch.value).trim()
  isLoading.value = true

  try {
    const nextListing = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      ...(nextPath ? { path: nextPath } : {}),
      ...(nextSearch ? { search: nextSearch } : {}),
    })

    listing.value = nextListing
    currentPath.value = nextListing.path

    if (!nextListing.path) {
      appliedSearch.value = nextSearch
      searchInput.value = nextSearch
    }

    syncTableState()
    pushLog({
      level: 'success',
      title: nextListing.path ? `Loaded ${nextListing.path}` : 'Loaded Redis keys',
      message: nextListing.path
        ? (nextListing.preview?.title ?? 'Redis key preview loaded.')
        : `${nextListing.items.length} key(s) loaded${nextSearch ? ` for ${nextSearch}` : ''}.`,
    })
  } catch (error) {
    pushLog({
      level: 'error',
      title: nextPath ? 'Redis preview failed' : 'Redis search failed',
      message: getErrorMessage(error, 'The Redis data could not be loaded'),
    })
  } finally {
    isLoading.value = false
  }
}

function refreshCurrentView() {
  void loadRedisData({
    path: currentPath.value,
    search: currentPath.value ? undefined : appliedSearch.value,
  })
}

function applySearch() {
  currentPath.value = ''
  void loadRedisData({
    path: '',
    search: searchInput.value,
  })
}

function clearSearch() {
  searchInput.value = ''
  if (!appliedSearch.value && !currentPath.value) {
    return
  }

  currentPath.value = ''
  void loadRedisData({ path: '', search: '' })
}

function openSelectedItem() {
  if (!selectedItem.value) {
    return
  }

  void loadRedisData({ path: selectedItem.value.path })
}

function goToRoot() {
  currentPath.value = ''
  void loadRedisData({
    path: '',
    search: appliedSearch.value,
  })
}

watch(
  () => props.data.path,
  (nextPath) => {
    currentPath.value = nextPath ?? ''
    void loadRedisData({
      path: currentPath.value,
      search: currentPath.value ? undefined : appliedSearch.value,
    })
  },
  { immediate: true },
)
</script>

<template>
  <GenericTableView
    v-model:columns="columns"
    v-model:rows="rows"
    v-model:focused-row-index="focusedRowIndex"
    :can-load-rows="canBrowse"
    :can-edit="false"
    :is-loading="isLoading"
    :file-base-name="fileBaseName"
    :table-name="currentPath || 'keys'"
    :show-pagination="false"
    :activity-logs="logs"
    empty-log-message="No Redis browser logs yet."
    :read-warning-message="
      !canBrowse ? 'This server account can open the datasource but cannot load Redis keys.' : null
    "
    :status-message="statusMessage"
    :show-save-button="false"
    :show-discard-button="false"
    :show-add-row-button="false"
    :show-delete-rows-button="false"
    @refresh="refreshCurrentView"
  >
    <template #toolbar-actions-prefix>
      <Button
        v-if="isPreviewMode"
        label="Back"
        icon="ti ti-arrow-left"
        size="small"
        text
        severity="secondary"
        @click="goToRoot"
      />
      <Button
        v-else
        label="Open"
        icon="ti ti-eye"
        size="small"
        text
        severity="secondary"
        :disabled="!selectedItem"
        @click="openSelectedItem"
      />
    </template>

    <template #filters>
      <template v-if="!isPreviewMode">
        <div class="flex items-center gap-2 min-w-0 flex-[1.4]">
          <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Search</span>
          <InputText
            v-model="searchInput"
            class="flex-1 min-w-[18rem]"
            size="small"
            placeholder="user:*"
            @keydown.enter.prevent="applySearch"
          />
          <Button
            icon="ti ti-search"
            size="small"
            text
            severity="secondary"
            :disabled="!canBrowse"
            @click="applySearch"
          />
          <Button
            icon="ti ti-x"
            size="small"
            text
            severity="secondary"
            :disabled="!searchInput && !appliedSearch"
            @click="clearSearch"
          />
        </div>
      </template>

      <template v-else>
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Key</span>
          <span class="text-sm truncate">{{ currentPath }}</span>
        </div>
        <div v-if="detailEntries.length" class="flex flex-wrap gap-2 py-1">
          <span
            v-for="entry of detailEntries"
            :key="entry.label"
            class="rounded-full border app-border px-2 py-1 text-[11px] mono opacity-70"
          >
            {{ entry.label }}: {{ entry.value }}
          </span>
        </div>
      </template>
    </template>
  </GenericTableView>
</template>
