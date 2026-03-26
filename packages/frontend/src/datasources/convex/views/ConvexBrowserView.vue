<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import GenericTableView from '@/datasources/shared/components/GenericTableView.vue'
import {
  buildConvexDocumentPreviewTable,
  buildConvexDocumentsTable,
  buildConvexTablesTable,
} from '@/datasources/convex/browser'
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
const page = ref(1)
const cursorStack = ref<Array<string | undefined>>([undefined])

const canBrowse = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const pathSegments = computed(() => currentPath.value.split('/').filter(Boolean))
const isRootMode = computed(() => !currentPath.value)
const isDocumentPreviewMode = computed(() => pathSegments.value[1] === '_doc')
const isTableMode = computed(() => Boolean(currentPath.value) && !isDocumentPreviewMode.value)
const selectedItem = computed<DataSourceResourceItem | null>(() => {
  if (focusedRowIndex.value === null || !listing.value || isDocumentPreviewMode.value) {
    return null
  }

  return listing.value.items[focusedRowIndex.value] ?? null
})
const currentTableName = computed(() => (isTableMode.value ? pathSegments.value[0] ?? '' : ''))
const statusMessage = computed(() => {
  if (isDocumentPreviewMode.value) {
    return listing.value?.preview?.title ?? 'Convex document preview'
  }

  if (isTableMode.value) {
    const loaded = rows.value.length
    return `Page ${page.value} • ${loaded} document(s) loaded${listing.value?.page?.hasMore ? ' • more available' : ''}`
  }

  return `${rows.value.length} table(s) loaded`
})
const fileBaseName = computed(() => {
  const suffix = currentPath.value || appliedSearch.value || 'tables'
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

function resetPaging() {
  page.value = 1
  cursorStack.value = [undefined]
}

function syncTableState() {
  focusedRowIndex.value = null

  if (!listing.value) {
    columns.value = []
    rows.value = []
    return
  }

  const tableData = isRootMode.value
    ? buildConvexTablesTable(listing.value)
    : isDocumentPreviewMode.value
      ? buildConvexDocumentPreviewTable(listing.value)
      : buildConvexDocumentsTable(listing.value)

  columns.value = tableData.columns
  rows.value = tableData.rows
}

async function loadConvexData(options?: {
  path?: string
  search?: string
  page?: number
  cursor?: string
  resetPaging?: boolean
}) {
  if (!canBrowse.value) {
    listing.value = null
    columns.value = []
    rows.value = []
    pushLog({
      level: 'error',
      title: 'Permission required',
      message: 'This server account can open the datasource but cannot load Convex tables.',
    })
    return
  }

  const nextPath = options?.path ?? currentPath.value
  const nextSearch = (options?.search ?? appliedSearch.value).trim()
  const nextPage = options?.page ?? page.value

  if (options?.resetPaging) {
    resetPaging()
  }

  isLoading.value = true

  try {
    const nextListing = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      ...(nextPath ? { path: nextPath } : {}),
      ...(nextSearch ? { search: nextSearch } : {}),
      ...(options?.cursor ? { cursor: options.cursor } : {}),
    })

    listing.value = nextListing
    currentPath.value = nextListing.path
    page.value = nextPage

    if (nextPage === 1) {
      appliedSearch.value = nextSearch
      searchInput.value = nextSearch
    }

    if (nextListing.page?.nextCursor) {
      cursorStack.value[nextPage] = nextListing.page.nextCursor
    } else {
      cursorStack.value = cursorStack.value.slice(0, nextPage)
    }

    syncTableState()
    pushLog({
      level: 'success',
      title: nextListing.path ? `Loaded ${nextListing.path}` : 'Loaded Convex tables',
      message: nextListing.path
        ? `${rows.value.length} row(s) loaded from ${nextListing.path}.`
        : `${nextListing.items.length} table(s) loaded.`,
    })
  } catch (error) {
    pushLog({
      level: 'error',
      title: nextPath ? 'Convex load failed' : 'Convex tables failed',
      message: getErrorMessage(error, 'The Convex data could not be loaded'),
    })
  } finally {
    isLoading.value = false
  }
}

function refreshCurrentView() {
  void loadConvexData({
    path: currentPath.value,
    search: appliedSearch.value,
    page: page.value,
    cursor: cursorStack.value[page.value - 1],
  })
}

function applySearch() {
  resetPaging()
  void loadConvexData({
    path: currentPath.value,
    search: searchInput.value,
    resetPaging: true,
  })
}

function clearSearch() {
  searchInput.value = ''
  if (!appliedSearch.value) {
    return
  }

  resetPaging()
  void loadConvexData({
    path: currentPath.value,
    search: '',
    resetPaging: true,
  })
}

function openSelectedItem() {
  if (!selectedItem.value) {
    return
  }

  resetPaging()
  void loadConvexData({
    path: selectedItem.value.path,
    search: '',
    resetPaging: true,
  })
}

function goBack() {
  const nextPath = isDocumentPreviewMode.value ? currentTableName.value : ''
  resetPaging()
  void loadConvexData({
    path: nextPath,
    search: '',
    resetPaging: true,
  })
}

function goToPreviousPage() {
  if (!isTableMode.value || page.value <= 1) {
    return
  }

  const nextPage = page.value - 1
  void loadConvexData({
    path: currentPath.value,
    search: appliedSearch.value,
    page: nextPage,
    cursor: cursorStack.value[nextPage - 1],
  })
}

function goToNextPage() {
  if (!isTableMode.value || !listing.value?.page?.hasMore) {
    return
  }

  const nextPage = page.value + 1
  void loadConvexData({
    path: currentPath.value,
    search: appliedSearch.value,
    page: nextPage,
    cursor: cursorStack.value[nextPage - 1],
  })
}

watch(
  () => props.data.path,
  (nextPath) => {
    currentPath.value = nextPath ?? ''
    resetPaging()
    void loadConvexData({
      path: currentPath.value,
      search: '',
      resetPaging: true,
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
    :table-name="currentPath || 'tables'"
    :show-pagination="false"
    :activity-logs="logs"
    empty-log-message="No Convex browser logs yet."
    :read-warning-message="
      !canBrowse ? 'This server account can open the datasource but cannot load Convex tables.' : null
    "
    :status-message="statusMessage"
    :show-save-button="false"
    :show-discard-button="false"
    :show-add-row-button="false"
    :show-delete-rows-button="false"
    @refresh="refreshCurrentView"
  >
    <template #toolbar-actions-prefix>
      <template v-if="isRootMode">
        <Button
          label="Open table"
          icon="ti ti-table"
          size="small"
          text
          severity="secondary"
          :disabled="!selectedItem"
          @click="openSelectedItem"
        />
      </template>

      <template v-else-if="isTableMode">
        <Button
          label="Back"
          icon="ti ti-arrow-left"
          size="small"
          text
          severity="secondary"
          @click="goBack"
        />
        <Button
          label="Preview"
          icon="ti ti-eye"
          size="small"
          text
          severity="secondary"
          :disabled="!selectedItem"
          @click="openSelectedItem"
        />
      </template>

      <Button
        v-else
        label="Back"
        icon="ti ti-arrow-left"
        size="small"
        text
        severity="secondary"
        @click="goBack"
      />

      <Button
        v-if="isTableMode"
        icon="ti ti-chevron-left"
        size="small"
        text
        severity="secondary"
        :disabled="page <= 1"
        @click="goToPreviousPage"
      />
      <Button
        v-if="isTableMode"
        icon="ti ti-chevron-right"
        size="small"
        text
        severity="secondary"
        :disabled="!listing?.page?.hasMore"
        @click="goToNextPage"
      />
    </template>

    <template #filters>
      <div class="flex items-center gap-2 min-w-0 flex-[1.4]">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">
          {{ isRootMode ? 'Tables' : isDocumentPreviewMode ? 'Document' : 'Search' }}
        </span>
        <InputText
          v-if="!isDocumentPreviewMode"
          v-model="searchInput"
          class="flex-1 min-w-[18rem]"
          size="small"
          :placeholder="isRootMode ? 'messages' : 'user_123'"
          @keydown.enter.prevent="applySearch"
        />
        <span v-else class="text-sm truncate">{{ currentPath }}</span>
        <Button
          v-if="!isDocumentPreviewMode"
          icon="ti ti-search"
          size="small"
          text
          severity="secondary"
          :disabled="!canBrowse"
          @click="applySearch"
        />
        <Button
          v-if="!isDocumentPreviewMode"
          icon="ti ti-x"
          size="small"
          text
          severity="secondary"
          :disabled="!searchInput && !appliedSearch"
          @click="clearSearch"
        />
      </div>

      <div v-if="isTableMode" class="flex items-center gap-2 text-xs mono opacity-55">
        <span>{{ currentTableName }}</span>
        <span>•</span>
        <span>Page {{ page }}</span>
      </div>
    </template>
  </GenericTableView>
</template>
