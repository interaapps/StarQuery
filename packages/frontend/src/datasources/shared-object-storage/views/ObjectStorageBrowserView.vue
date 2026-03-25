<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import {
  getContainerResourcePath,
  getParentResourcePath,
  getResourceName,
  joinResourcePath,
  resolveObjectStorageInitialState,
} from '@/datasources/shared-object-storage/browser'
import {
  deleteDataSourceResources,
  downloadDataSourceResourceObject,
  loadDataSourceResources,
  uploadDataSourceResourceObject,
} from '@/datasources/shared-resource/browser'
import ResizeKnob from '@/components/ResizeKnob.vue'
import DataExportButton from '@/components/common/DataExportButton.vue'
import CreateObjectDialog from '@/components/datasources/object-storage/CreateObjectDialog.vue'
import ObjectStoragePreviewPanel from '@/components/datasources/object-storage/ObjectStoragePreviewPanel.vue'
import ObjectStorageResourceTable from '@/components/datasources/object-storage/ObjectStorageResourceTable.vue'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import {
  dataSourceReadPermissionTargets,
  dataSourceWritePermissionTargets,
} from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type {
  DataSourceBrowserTabData,
  DataSourceResourceItem,
  DataSourceResourceListing,
} from '@/types/datasources'

const LIST_PAGE_SIZE = 200

const props = defineProps<{
  data: DataSourceBrowserTabData
}>()

const toast = useToast()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const client = createBackendClient(props.data.serverUrl)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

const sourceRecord = computed(() =>
  workspaceStore.dataSources.find((source) => source.id === props.data.sourceId),
)
const defaultBucket = computed(() => {
  const bucket = sourceRecord.value?.config?.bucket
  return typeof bucket === 'string' ? bucket.trim() : ''
})

const isLoadingListing = ref(false)
const isLoadingPreview = ref(false)
const isLoadingMore = ref(false)
const isUploading = ref(false)
const isDeleting = ref(false)
const listing = ref<DataSourceResourceListing | null>(null)
const selectedListing = ref<DataSourceResourceListing | null>(null)
const currentFolderPath = ref('')
const selectedItemPath = ref('')
const selectedResources = ref<DataSourceResourceItem[]>([])
const searchInput = ref('')
const appliedSearch = ref('')
const createDialogVisible = ref(false)
const previewPanelWidth = ref(360)

const canBrowseSource = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)

const canWriteSource = computed(() =>
  authStore.hasPermission(
    dataSourceWritePermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)

const activeListing = computed(() => selectedListing.value ?? listing.value)

const breadcrumbSegments = computed(() => {
  const segments = currentFolderPath.value.split('/').filter(Boolean)
  const items = [{ label: 'Buckets', path: '' }]
  let path = ''

  segments.forEach((segment) => {
    path = path ? `${path}/${segment}` : segment
    items.push({
      label: segment,
      path: `${path}/`,
    })
  })

  return items
})

const hasFolderTarget = computed(() => Boolean(currentFolderPath.value))
const createDialogInitialPath = computed(() =>
  currentFolderPath.value ? joinResourcePath(currentFolderPath.value, 'new-object.txt') : '',
)
const parentFolderPath = computed(() => getParentResourcePath(currentFolderPath.value))
const deleteTargets = computed(() => {
  if (selectedResources.value.length) {
    return selectedResources.value.map((item) => item.path)
  }

  return selectedItemPath.value ? [selectedItemPath.value] : []
})
const hasMoreItems = computed(() => listing.value?.page?.hasMore === true)
const nextCursor = computed(() => listing.value?.page?.nextCursor ?? null)
const exportColumns = ['name', 'kind', 'path', 'description', 'metadata']
const exportRows = computed(() =>
  (listing.value?.items ?? []).map((item) => ({
    name: item.name,
    kind: item.kind,
    path: item.path,
    description: item.description ?? '',
    metadata: item.metadata ? JSON.stringify(item.metadata) : '',
  })),
)
const exportFileBaseName = computed(() => {
  const base = props.data.sourceName.replace(/\s+/g, '-').toLowerCase() || 'object-storage'
  const suffix = currentFolderPath.value
    ? currentFolderPath.value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : 'buckets'
  return `${base}-${suffix}`
})

async function loadFolder(options?: {
  path?: string
  search?: string
  append?: boolean
  cursor?: string | null
}) {
  const requestedPath = options?.path ?? currentFolderPath.value
  const requestedSearch = options?.search ?? appliedSearch.value
  const append = options?.append === true

  if (append) {
    isLoadingMore.value = true
  } else {
    isLoadingListing.value = true
    if (requestedPath !== currentFolderPath.value) {
      selectedResources.value = []
    }
  }

  try {
    const response = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path: requestedPath,
      search: requestedSearch,
      limit: LIST_PAGE_SIZE,
      cursor: options?.cursor ?? undefined,
    })

    currentFolderPath.value = response.path
    listing.value =
      append && listing.value
        ? {
            ...response,
            items: [...listing.value.items, ...response.items],
          }
        : response
  } catch (error) {
    const detail = getErrorMessage(error, 'The datasource resources could not be loaded')
    toast.add({
      severity: 'error',
      summary: 'Resource load failed',
      detail,
      life: 3200,
    })
  } finally {
    isLoadingListing.value = false
    isLoadingMore.value = false
  }
}

async function loadMoreItems() {
  if (!hasMoreItems.value || !nextCursor.value || isLoadingMore.value || isLoadingListing.value) {
    return
  }

  await loadFolder({
    path: currentFolderPath.value,
    search: appliedSearch.value,
    append: true,
    cursor: nextCursor.value,
  })
}

async function loadSelection(path = selectedItemPath.value) {
  if (!path) {
    selectedListing.value = null
    return
  }

  isLoadingPreview.value = true
  try {
    selectedListing.value = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path,
    })
  } catch (error) {
    const detail = getErrorMessage(error, 'The selected object could not be previewed')
    toast.add({
      severity: 'error',
      summary: 'Preview failed',
      detail,
      life: 3200,
    })
  } finally {
    isLoadingPreview.value = false
  }
}

async function syncFromPath(path: string | undefined) {
  const nextState = resolveObjectStorageInitialState(path, defaultBucket.value)
  currentFolderPath.value = nextState.containerPath
  selectedItemPath.value = nextState.selectedPath
  selectedResources.value = []
  await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })

  if (selectedItemPath.value) {
    await loadSelection(selectedItemPath.value)
    return
  }

  selectedListing.value = null
}

async function navigateTo(path: string) {
  currentFolderPath.value = getContainerResourcePath(path)
  selectedItemPath.value = ''
  selectedResources.value = []
  selectedListing.value = null
  await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
}

async function previewItem(item: DataSourceResourceItem) {
  if (item.kind === 'container') {
    await navigateTo(item.path)
    return
  }

  selectedItemPath.value = item.path
  await loadSelection(item.path)
}

async function openItem(item: DataSourceResourceItem) {
  if (item.kind === 'container') {
    await navigateTo(item.path)
    return
  }

  await previewItem(item)
}

async function applySearch() {
  appliedSearch.value = searchInput.value.trim()
  selectedResources.value = []
  await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
}

async function clearSearch() {
  searchInput.value = ''
  appliedSearch.value = ''
  selectedResources.value = []
  await loadFolder({ path: currentFolderPath.value, search: '' })
}

async function refreshCurrentView() {
  await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
  if (selectedItemPath.value) {
    await loadSelection(selectedItemPath.value)
  }
}

async function downloadSelectedObject() {
  if (!selectedItemPath.value) {
    return
  }

  try {
    await downloadDataSourceResourceObject({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path: selectedItemPath.value,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail: getErrorMessage(error, 'The selected object could not be downloaded'),
      life: 3200,
    })
  }
}

async function deleteResources(items?: DataSourceResourceItem[]) {
  const targets = items?.length ? items.map((item) => item.path) : deleteTargets.value
  if (!targets.length) {
    return
  }

  const label =
    targets.length === 1
      ? `Delete ${getResourceName(targets[0]!) || 'this entry'}?`
      : `Delete ${targets.length} selected entries?`
  if (!window.confirm(label)) {
    return
  }

  isDeleting.value = true

  try {
    const response = await deleteDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      paths: targets,
    })

    if (targets.includes(selectedItemPath.value)) {
      selectedItemPath.value = ''
      selectedListing.value = null
    }
    selectedResources.value = []
    await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Delete failed',
      detail: getErrorMessage(error, 'The selected entries could not be deleted'),
      life: 3200,
    })
  } finally {
    isDeleting.value = false
  }
}

function openUploadPicker() {
  fileInput.value?.click()
}

async function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]
  if (!file) {
    return
  }

  if (!currentFolderPath.value) {
    toast.add({
      severity: 'warn',
      summary: 'Select a bucket first',
      detail: 'Open a bucket or folder before uploading a file.',
      life: 2600,
    })
    input.value = ''
    return
  }

  const targetPath = joinResourcePath(currentFolderPath.value, file.name)
  isUploading.value = true

  try {
    await uploadDataSourceResourceObject({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path: targetPath,
      body: file,
      contentType: file.type || 'application/octet-stream',
    })
    await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
    selectedItemPath.value = targetPath
    await loadSelection(targetPath)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Upload failed',
      detail: getErrorMessage(error, 'The file could not be uploaded'),
      life: 3200,
    })
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

async function createObject(payload: { path: string; content: string; contentType: string }) {
  isUploading.value = true

  try {
    await uploadDataSourceResourceObject({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path: payload.path,
      body: payload.content,
      contentType: payload.contentType,
    })

    createDialogVisible.value = false
    currentFolderPath.value = getContainerResourcePath(payload.path)
    await loadFolder({ path: currentFolderPath.value, search: appliedSearch.value })
    selectedItemPath.value = payload.path
    await loadSelection(payload.path)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail: getErrorMessage(error, 'The object could not be created'),
      life: 3200,
    })
  } finally {
    isUploading.value = false
  }
}

watch(
  [() => props.data.path, defaultBucket, canBrowseSource],
  async ([nextPath, , nextCanBrowse]) => {
    if (!nextCanBrowse) {
      listing.value = null
      selectedListing.value = null
      return
    }

    await syncFromPath(nextPath)
  },
  { immediate: true },
)
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="border-b app-border px-4 py-2 flex items-center gap-3">
      <div class="min-w-0 flex items-center gap-1 overflow-auto text-sm">
        <button
          v-for="(item, index) in breadcrumbSegments"
          :key="item.path || 'root'"
          class="shrink-0 rounded-md px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900"
          @click="navigateTo(item.path)"
        >
          <span class="opacity-70">{{ item.label }}</span>
          <span v-if="index < breadcrumbSegments.length - 1" class="ml-2 opacity-35">/</span>
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <Button
          size="small"
          icon="ti ti-arrow-up"
          text
          severity="secondary"
          :disabled="!parentFolderPath"
          @click="navigateTo(parentFolderPath)"
        />
        <InputText
          v-model="searchInput"
          class="w-[14rem]"
          placeholder="Search current folder"
          @keydown.enter.prevent="applySearch"
          size="small"
        />
        <Button
          size="small"
          icon="ti ti-refresh"
          text
          severity="secondary"
          @click="refreshCurrentView"
        />
      </div>
    </div>

    <Message v-if="!canBrowseSource" severity="warn" class="m-3 mb-0">
      This server account is not allowed to browse this datasource.
    </Message>

    <div class="border-b app-border px-3 py-2 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Object Storage</div>
        <div class="text-sm truncate">{{ currentFolderPath || 'Buckets' }}</div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          icon="ti ti-file-plus"
          label="Create"
          size="small"
          outlined
          :disabled="!canWriteSource || isUploading || isDeleting"
          @click="createDialogVisible = true"
        />
        <Button
          icon="ti ti-upload"
          label="Upload"
          size="small"
          outlined
          :disabled="!canWriteSource || !hasFolderTarget || isUploading || isDeleting"
          @click="openUploadPicker"
        />
        <Button
          icon="ti ti-trash"
          label="Delete"
          size="small"
          outlined
          :disabled="!canWriteSource || !deleteTargets.length || isDeleting || isUploading"
          @click="deleteResources()"
        />

        <DataExportButton
          :file-base-name="exportFileBaseName"
          :columns="exportColumns"
          :rows="exportRows"
          :disabled="!listing?.items?.length"
          :smaller="false"
          severity="primary"
          label="Export list"
        />
        <Button
          icon="ti ti-download"
          label="Download"
          size="small"
          :disabled="!selectedItemPath || isDeleting"
          @click="downloadSelectedObject"
        />
      </div>
    </div>

    <div class="min-h-0 flex flex-1 overflow-hidden">
      <div class="min-h-0 min-w-0 flex-1 border-r app-border">
        <ObjectStorageResourceTable
          v-model:selection="selectedResources"
          :items="listing?.items ?? []"
          :loading="isLoadingListing"
          :loading-more="isLoadingMore"
          :has-more="hasMoreItems"
          :selected-path="selectedItemPath"
          :can-write="canWriteSource"
          @open="openItem"
          @preview="previewItem"
          @delete-items="deleteResources"
          @load-more="loadMoreItems"
        />
      </div>

      <ResizeKnob
        v-model:width="previewPanelWidth"
        :min-width="220"
        invert
        class="border-r app-border"
      />

      <div :style="{ width: `${previewPanelWidth}px` }" class="min-h-0 min-w-0 shrink-0">
        <ObjectStoragePreviewPanel
          :listing="activeListing"
          :loading="isLoadingPreview"
          class="h-full"
        />
      </div>
    </div>

    <input ref="fileInput" type="file" class="hidden" @change="handleFileSelection" />

    <CreateObjectDialog
      v-model:visible="createDialogVisible"
      :initial-path="createDialogInitialPath"
      @submit="createObject"
    />
  </div>
</template>
