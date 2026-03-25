<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import CollapsiblePanel from '@/components/common/CollapsiblePanel.vue'
import DataExportButton from '@/components/common/DataExportButton.vue'
import DataPaginationBar from '@/components/common/DataPaginationBar.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import MongoDbCreateCollectionDialog from '@/components/datasources/mongodb/MongoDbCreateCollectionDialog.vue'
import MongoDbDocumentViewer from '@/components/datasources/mongodb/MongoDbDocumentViewer.vue'
import MongoDbResultsTable from '@/components/datasources/mongodb/MongoDbResultsTable.vue'
import JsonEditor from '@/components/editors/JsonEditor.vue'
import SQLActivityPanel, { type SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import {
  createMongoDbCollection,
  DEFAULT_MONGODB_FILTER,
  DEFAULT_MONGODB_PROJECTION,
  DEFAULT_MONGODB_SORT,
  deleteMongoDbCollection,
  deleteMongoDbDocuments,
  getMongoDocumentFromRow,
  getMongoDocumentIdFromRow,
  parseMongoEditorObject,
  parseMongoPath,
  replaceMongoDbDocument,
  runMongoDbQuery,
  insertMongoDbDocument,
} from '@/datasources/mongodb/browser'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import {
  dataSourceReadPermissionTargets,
  dataSourceWritePermissionTargets,
} from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { loadDataSourceResources } from '@/datasources/shared-resource/browser'
import type {
  DataSourceBrowserTabData,
  DataSourceResourceItem,
  MongoDbQueryResult,
} from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = defineProps<{
  data: DataSourceBrowserTabData
}>()

const toast = useToast()
const confirm = useConfirm()
const authStore = useAuthStore()
const client = createBackendClient(props.data.serverUrl)
const resultsTable = useTemplateRef<InstanceType<typeof MongoDbResultsTable>>('resultsTable')

const databaseName = ref('')
const collectionName = ref('')
const filterJson = ref(DEFAULT_MONGODB_FILTER)
const sortJson = ref(DEFAULT_MONGODB_SORT)
const projectionJson = ref(DEFAULT_MONGODB_PROJECTION)
const skip = ref(0)
const limit = ref(25)
const queryHeight = ref(170)
const viewerWidth = ref(420)
const logsHeight = ref(160)
const queryVisible = ref(true)
const resultsVisible = ref(true)
const logsVisible = ref(false)
const result = ref<MongoDbQueryResult | null>(null)
const collectionItems = ref<DataSourceResourceItem[]>([])
const isLoadingCollectionItems = ref(false)
const columns = ref<SQLTableColumn[]>([])
const rows = ref<SQLTableRowDraft[]>([])
const focusedRowIndex = ref<number | null>(null)
const isRunningQuery = ref(false)
const isSavingDocument = ref(false)
const logs = ref<SQLActivityEntry[]>([])
const documentViewerMode = ref<'new' | 'selected'>('selected')
const documentJson = ref('{\n}')
const documentBaselineJson = ref('{\n}')
const selectedDocumentId = ref<unknown | null>(null)
const createCollectionVisible = ref(false)
const pendingFocusDocumentKey = ref<string | null>(null)

const canQuery = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const canWrite = computed(() =>
  authStore.hasPermission(
    dataSourceWritePermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const hasSelectedDatabase = computed(() => Boolean(databaseName.value))
const hasSelectedCollection = computed(() => Boolean(databaseName.value && collectionName.value))
const currentPage = computed(() => Math.floor(skip.value / Math.max(limit.value, 1)) + 1)
const pageCount = computed(() =>
  result.value ? Math.max(1, Math.ceil(result.value.total / Math.max(limit.value, 1))) : null,
)
const canGoToPreviousPage = computed(() => skip.value > 0)
const canGoToNextPage = computed(() =>
  result.value ? skip.value + limit.value < result.value.total : false,
)
const paginationSummary = computed(() =>
  result.value ? `${result.value.total} document${result.value.total === 1 ? '' : 's'}` : null,
)
const resultSummary = computed(() => {
  if (!result.value) {
    return null
  }

  return `${result.value.returned} returned / ${result.value.total} total`
})
const exportColumns = computed(() => columns.value.map((column) => column.field))
const exportRows = computed(() =>
  rows.value.map((row) =>
    Object.fromEntries(columns.value.map((column) => [column.field, row.values[column.field] ?? null])),
  ),
)
const documentViewerDirty = computed(
  () => documentJson.value.trim() !== documentBaselineJson.value.trim(),
)
const canSaveCurrentDocument = computed(() =>
  documentViewerMode.value === 'new' || selectedDocumentId.value !== null,
)
const canDeleteCurrentDocument = computed(
  () => documentViewerMode.value === 'selected' && selectedDocumentId.value !== null,
)
const selectedDocumentLabel = computed(() => {
  if (documentViewerMode.value === 'new') {
    return 'New document'
  }

  if (!result.value || focusedRowIndex.value === null) {
    return null
  }

  return result.value.documents[focusedRowIndex.value]?.idLabel ?? null
})
const canCreateCollection = computed(() => hasSelectedDatabase.value && canWrite.value)

function pushLog(entry: Omit<SQLActivityEntry, 'id'>) {
  logs.value = [
    {
      id: `${entry.level}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...entry,
    },
    ...logs.value,
  ].slice(0, 30)
}

function loadDocumentIntoViewer(row: SQLTableRowDraft | null | undefined) {
  const document = getMongoDocumentFromRow(row)
  const documentId = getMongoDocumentIdFromRow(row)

  if (!document) {
    documentViewerMode.value = 'selected'
    selectedDocumentId.value = null
    documentJson.value = '{\n}'
    documentBaselineJson.value = '{\n}'
    return
  }

  documentViewerMode.value = 'selected'
  selectedDocumentId.value = documentId
  const serialized = JSON.stringify(document, null, 2)
  documentJson.value = serialized
  documentBaselineJson.value = serialized
}

function loadFocusedDocumentIntoViewer(options?: { force?: boolean }) {
  if (!options?.force && documentViewerDirty.value) {
    return
  }

  const row = resultsTable.value?.getFocusedRow() ?? null
  loadDocumentIntoViewer(row)
}

function startNewDocument() {
  documentViewerMode.value = 'new'
  selectedDocumentId.value = null
  documentJson.value = '{\n}'
  documentBaselineJson.value = '{\n}'
}

function resetDocumentViewer() {
  if (documentViewerMode.value === 'new') {
    startNewDocument()
    return
  }

  loadFocusedDocumentIntoViewer({ force: true })
}

function guardViewerChanges(message: string) {
  if (!documentViewerDirty.value) {
    return false
  }

  pushLog({
    level: 'info',
    title: 'Unsaved viewer changes',
    message,
  })
  toast.add({
    severity: 'warn',
    summary: 'Unsaved viewer changes',
    detail: message,
    life: 2600,
  })
  return true
}

function restoreFocusedDocument() {
  if (!pendingFocusDocumentKey.value || !result.value) {
    return
  }

  const nextIndex = result.value.documents.findIndex(
    (document) => JSON.stringify(document.idValue) === pendingFocusDocumentKey.value,
  )
  pendingFocusDocumentKey.value = null

  if (nextIndex === -1) {
    if (result.value.documents.length) {
      resultsTable.value?.focusRow(0)
    } else {
      startNewDocument()
    }
    return
  }

  resultsTable.value?.focusRow(nextIndex)
}

async function runQuery(options?: { keepPage?: boolean }) {
  if (!hasSelectedCollection.value) {
    result.value = null
    columns.value = []
    rows.value = []
    return
  }

  if (!canQuery.value) {
    pushLog({
      level: 'error',
      title: 'Permission required',
      message: 'This server account is not allowed to query this MongoDB datasource.',
    })
    return
  }

  let filter: Record<string, unknown>
  let sort: Record<string, unknown>
  let projection: Record<string, unknown>

  try {
    filter = parseMongoEditorObject(filterJson.value, 'Filter')
    sort = parseMongoEditorObject(sortJson.value, 'Sort')
    projection = parseMongoEditorObject(projectionJson.value, 'Projection')
    filterJson.value = JSON.stringify(filter, null, 2)
    sortJson.value = JSON.stringify(sort, null, 2)
    projectionJson.value = JSON.stringify(projection, null, 2)
  } catch (error) {
    const detail = getErrorMessage(error, 'The MongoDB query JSON is invalid')
    pushLog({
      level: 'error',
      title: 'Invalid query JSON',
      message: detail,
    })
    logsVisible.value = true
    return
  }

  isRunningQuery.value = true

  try {
    if (!options?.keepPage) {
      skip.value = 0
    }

    const response = await runMongoDbQuery({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      database: databaseName.value,
      collection: collectionName.value,
      filter,
      sort,
      projection,
      skip: skip.value,
      limit: limit.value,
    })
    result.value = response
    pushLog({
      level: 'success',
      title: `Loaded ${response.collection}`,
      message: `${response.returned} document(s) returned out of ${response.total}.`,
    })
    requestAnimationFrame(() => {
      restoreFocusedDocument()
      if (
        documentViewerMode.value !== 'new' &&
        !pendingFocusDocumentKey.value &&
        response.documents.length
      ) {
        loadFocusedDocumentIntoViewer()
      }
    })
  } catch (error) {
    const detail = getErrorMessage(error, 'The MongoDB documents could not be loaded')
    result.value = null
    columns.value = []
    rows.value = []
    pushLog({
      level: 'error',
      title: `Query failed on ${collectionName.value}`,
      message: detail,
    })
    logsVisible.value = true
    toast.add({
      severity: 'error',
      summary: 'MongoDB query failed',
      detail,
      life: 3200,
    })
  } finally {
    isRunningQuery.value = false
  }
}

async function loadCollectionItems() {
  if (!hasSelectedDatabase.value) {
    collectionItems.value = []
    return
  }

  isLoadingCollectionItems.value = true

  try {
    const listing = await loadDataSourceResources({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      path: databaseName.value,
    })
    collectionItems.value = listing.items
  } catch (error) {
    const detail = getErrorMessage(error, 'The MongoDB collections could not be loaded')
    pushLog({
      level: 'error',
      title: `Collection list failed on ${databaseName.value}`,
      message: detail,
    })
    logsVisible.value = true
  } finally {
    isLoadingCollectionItems.value = false
  }
}

function formatEditors() {
  try {
    filterJson.value = JSON.stringify(parseMongoEditorObject(filterJson.value, 'Filter'), null, 2)
    sortJson.value = JSON.stringify(parseMongoEditorObject(sortJson.value, 'Sort'), null, 2)
    projectionJson.value = JSON.stringify(
      parseMongoEditorObject(projectionJson.value, 'Projection'),
      null,
      2,
    )
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Format failed',
      detail: getErrorMessage(error, 'The MongoDB query JSON is invalid'),
      life: 2600,
    })
  }
}

function resetEditors() {
  filterJson.value = DEFAULT_MONGODB_FILTER
  sortJson.value = DEFAULT_MONGODB_SORT
  projectionJson.value = DEFAULT_MONGODB_PROJECTION
  skip.value = 0
  limit.value = 25
}

async function openCollection(path: string) {
  const parsed = parseMongoPath(path)
  if (!parsed.collection) {
    return
  }

  collectionName.value = parsed.collection
  pendingFocusDocumentKey.value = parsed.documentToken || null
  await runQuery()
}

async function changePage(nextPage: number) {
  if (guardViewerChanges('Save or reset the document viewer before changing pages.')) {
    return
  }

  const boundedPage =
    pageCount.value !== null
      ? Math.min(Math.max(nextPage, 1), pageCount.value)
      : Math.max(nextPage, 1)
  skip.value = (boundedPage - 1) * limit.value
  await runQuery({ keepPage: true })
}

async function changePageSize(nextPageSize: number) {
  if (guardViewerChanges('Save or reset the document viewer before changing page size.')) {
    return
  }

  limit.value = nextPageSize
  skip.value = 0
  await runQuery({ keepPage: true })
}

async function saveDocument() {
  if (!hasSelectedCollection.value || !canWrite.value) {
    return
  }

  let document: Record<string, unknown>
  try {
    document = parseMongoEditorObject(documentJson.value, 'Document')
    documentJson.value = JSON.stringify(document, null, 2)
  } catch (error) {
    const detail = getErrorMessage(error, 'The document viewer JSON is invalid')
    pushLog({
      level: 'error',
      title: 'Invalid document JSON',
      message: detail,
    })
    logsVisible.value = true
    return
  }

  isSavingDocument.value = true

  try {
    if (documentViewerMode.value === 'new') {
      const response = await insertMongoDbDocument({
        client,
        projectId: props.data.projectId,
        sourceId: props.data.sourceId,
        database: databaseName.value,
        collection: collectionName.value,
        document,
      })
      pendingFocusDocumentKey.value = JSON.stringify(response.document.idValue)
      pushLog({
        level: 'success',
        title: `Document created in ${collectionName.value}`,
        message: `Inserted ${response.document.idLabel}.`,
      })
      toast.add({
        severity: 'success',
        summary: 'Document created',
        detail: `Inserted document into ${collectionName.value}`,
        life: 2200,
      })
    } else {
      const response = await replaceMongoDbDocument({
        client,
        projectId: props.data.projectId,
        sourceId: props.data.sourceId,
        database: databaseName.value,
        collection: collectionName.value,
        id: selectedDocumentId.value,
        document,
      })
      pendingFocusDocumentKey.value = JSON.stringify(response.document.idValue)
      pushLog({
        level: 'success',
        title: `Document saved in ${collectionName.value}`,
        message: `${response.document.idLabel} updated.`,
      })
      toast.add({
        severity: 'success',
        summary: 'Document saved',
        detail: `Updated ${response.document.idLabel}`,
        life: 2200,
      })
    }

    await runQuery({ keepPage: true })
  } catch (error) {
    const detail = getErrorMessage(error, 'The MongoDB document could not be saved')
    pushLog({
      level: 'error',
      title: 'Document save failed',
      message: detail,
    })
    logsVisible.value = true
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail,
      life: 3200,
    })
  } finally {
    isSavingDocument.value = false
  }
}

function deleteDocumentsByIds(ids: unknown[], label: string) {
  confirm.require({
    header: 'Delete Documents',
    message: `Delete ${label}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const response = await deleteMongoDbDocuments({
          client,
          projectId: props.data.projectId,
          sourceId: props.data.sourceId,
          database: databaseName.value,
          collection: collectionName.value,
          ids,
        })
        pushLog({
          level: 'success',
          title: `Documents deleted from ${collectionName.value}`,
          message: `${response.deletedCount} document(s) deleted.`,
        })
        toast.add({
          severity: 'success',
          summary: 'Documents deleted',
          detail: `${response.deletedCount} document(s) removed`,
          life: 2200,
        })
        pendingFocusDocumentKey.value = null
        await runQuery({ keepPage: true })
      } catch (error) {
        const detail = getErrorMessage(error, 'The MongoDB documents could not be deleted')
        pushLog({
          level: 'error',
          title: 'Delete failed',
          message: detail,
        })
        logsVisible.value = true
        toast.add({
          severity: 'error',
          summary: 'Delete failed',
          detail,
          life: 3200,
        })
      }
    },
  })
}

function deleteSelectedDocuments() {
  if (!hasSelectedCollection.value || !canWrite.value) {
    return
  }

  const selectedRows = resultsTable.value?.getSelectedRows() ?? []
  const ids = selectedRows
    .map((row: SQLTableRowDraft) => getMongoDocumentIdFromRow(row))
    .filter((id: unknown | null): id is unknown => id !== null)

  if (!ids.length) {
    const focusedId = selectedDocumentId.value
    if (focusedId !== null) {
      deleteDocumentsByIds([focusedId], selectedDocumentLabel.value || 'the selected document')
    }
    return
  }

  deleteDocumentsByIds(ids, `${ids.length} selected document(s)`)
}

function deleteCurrentViewerDocument() {
  if (documentViewerMode.value !== 'selected' || selectedDocumentId.value === null) {
    return
  }

  deleteDocumentsByIds([selectedDocumentId.value], selectedDocumentLabel.value || 'the selected document')
}

async function createCollection(collection: string) {
  try {
    await createMongoDbCollection({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      database: databaseName.value,
      collection,
    })
    collectionName.value = collection
    createCollectionVisible.value = false
    pushLog({
      level: 'success',
      title: `Collection created in ${databaseName.value}`,
      message: `${collection} is now available.`,
    })
    toast.add({
      severity: 'success',
      summary: 'Collection created',
      detail: `${collection} has been created`,
      life: 2200,
    })
    await loadCollectionItems()
    await runQuery()
  } catch (error) {
    const detail = getErrorMessage(error, 'The MongoDB collection could not be created')
    pushLog({
      level: 'error',
      title: 'Collection create failed',
      message: detail,
    })
    logsVisible.value = true
    toast.add({
      severity: 'error',
      summary: 'Create failed',
      detail,
      life: 3200,
    })
  }
}

function confirmDeleteCollection() {
  if (!hasSelectedCollection.value || !canWrite.value) {
    return
  }

  confirm.require({
    header: 'Delete Collection',
    message: `Delete collection ${collectionName.value}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteMongoDbCollection({
          client,
          projectId: props.data.projectId,
          sourceId: props.data.sourceId,
          database: databaseName.value,
          collection: collectionName.value,
        })
        pushLog({
          level: 'success',
          title: `Collection deleted from ${databaseName.value}`,
          message: `${collectionName.value} has been removed.`,
        })
        toast.add({
          severity: 'success',
          summary: 'Collection deleted',
          detail: `${collectionName.value} has been removed`,
          life: 2200,
        })
        collectionName.value = ''
        result.value = null
        await loadCollectionItems()
        columns.value = []
        rows.value = []
        startNewDocument()
      } catch (error) {
        const detail = getErrorMessage(error, 'The MongoDB collection could not be deleted')
        pushLog({
          level: 'error',
          title: 'Collection delete failed',
          message: detail,
        })
        logsVisible.value = true
        toast.add({
          severity: 'error',
          summary: 'Delete failed',
          detail,
          life: 3200,
        })
      }
    },
  })
}

watch(
  () => props.data.path,
  async (nextPath) => {
    if (guardViewerChanges('Reset the document viewer before opening a different MongoDB path.')) {
      return
    }

    const parsed = parseMongoPath(nextPath)
    databaseName.value = parsed.database
    collectionName.value = parsed.collection
    pendingFocusDocumentKey.value = parsed.documentToken || null

    if (parsed.collection) {
      await runQuery()
      return
    }

    result.value = null
    await loadCollectionItems()
    columns.value = []
    rows.value = []
    startNewDocument()
  },
  { immediate: true },
)

watch(
  focusedRowIndex,
  () => {
    if (documentViewerMode.value === 'new') {
      return
    }

    loadFocusedDocumentIntoViewer()
  },
)
</script>

<template>
  <div class="flex h-full flex-col">
    <Message v-if="!canQuery" severity="warn" class="m-3 mb-0">
      This server account can open the datasource but cannot query MongoDB collections on it.
    </Message>

    <div class="border-b app-border px-3 py-2 flex items-center justify-between gap-3">
      <div class="min-w-0 space-y-0.5">
        <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">MongoDB</div>
        <div class="truncate text-sm">
          <template v-if="hasSelectedCollection">
            {{ databaseName }} / {{ collectionName }}
          </template>
          <template v-else-if="hasSelectedDatabase">
            {{ databaseName }}
          </template>
          <template v-else>
            No database selected
          </template>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          icon="ti ti-plus"
          label="Add document"
          text
          severity="secondary"
          size="small"
          :disabled="!hasSelectedCollection || !canWrite || isRunningQuery || isSavingDocument"
          @click="startNewDocument"
        />
        <Button
          icon="ti ti-plus"
          label="Collection"
          text
          severity="secondary"
          size="small"
          :disabled="!canCreateCollection || isRunningQuery || isSavingDocument"
          @click="createCollectionVisible = true"
        />
        <Button
          icon="ti ti-refresh"
          text
          severity="secondary"
          size="small"
          :disabled="!hasSelectedCollection || isRunningQuery || isSavingDocument"
          @click="runQuery({ keepPage: true })"
        />
        <Button
          icon="ti ti-player-play"
          label="Run"
          size="small"
          :loading="isRunningQuery"
          :disabled="!hasSelectedCollection || !canQuery || isSavingDocument"
          @click="runQuery()"
        />
      </div>
    </div>

    <Message v-if="!hasSelectedDatabase" severity="secondary" :closable="false" class="m-3 mb-0">
      Select a MongoDB database from the sidebar to manage its collections and documents.
    </Message>

    <div v-else-if="!hasSelectedCollection" class="m-3 mb-0 rounded-2xl border app-border overflow-hidden">
      <div class="border-b app-border px-3 py-2 flex items-center justify-between gap-3">
        <div>
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Collections</div>
          <div class="text-sm">{{ databaseName }}</div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            icon="ti ti-refresh"
            text
            severity="secondary"
            size="small"
            :disabled="isLoadingCollectionItems"
            @click="loadCollectionItems"
          />
          <Button
            icon="ti ti-plus"
            label="Collection"
            size="small"
            :disabled="!canCreateCollection"
            @click="createCollectionVisible = true"
          />
        </div>
      </div>

      <div v-if="isLoadingCollectionItems" class="px-3 py-4 text-sm opacity-60">
        Loading collections...
      </div>
      <div v-else-if="collectionItems.length" class="p-3 grid gap-2">
        <Button
          v-for="item of collectionItems"
          :key="item.id"
          :label="item.name"
          icon="ti ti-database"
          outlined
          class="justify-start"
          size="small"
          @click="openCollection(item.path)"
        />
      </div>
      <div v-else class="px-3 py-4 text-sm opacity-60">
        No collections in {{ databaseName }} yet. Create one to start managing documents.
      </div>
    </div>

    <template v-else>
      <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
        <CollapsiblePanel
          v-model:expanded="queryVisible"
          title="Query"
          root-class="border-b app-border"
          body-class="border-t app-border"
        >
          <template #title>
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Query</span>
          </template>

          <template #actions>
            <Button
              icon="ti ti-braces"
              label="Format"
              text
              severity="secondary"
              size="small"
              @click="formatEditors"
            />
            <Button
              icon="ti ti-restore"
              label="Reset"
              text
              severity="secondary"
              size="small"
              @click="resetEditors"
            />
          </template>

          <div class="grid grid-cols-[repeat(2,minmax(0,10rem))_1fr] gap-3 px-3 py-3 items-end">
            <div class="flex flex-col gap-2">
              <label class="text-sm opacity-70">Skip</label>
              <InputNumber v-model="skip" fluid :min="0" :use-grouping="false" size="small" />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm opacity-70">Limit</label>
              <InputNumber
                v-model="limit"
                fluid
                :min="1"
                :max="500"
                :use-grouping="false"
                size="small"
              />
            </div>
            <div class="flex items-center justify-end gap-2">
              <Button
                icon="ti ti-trash"
                label="Delete selected"
                text
                severity="danger"
                size="small"
                :disabled="!canWrite || isRunningQuery || isSavingDocument"
                @click="deleteSelectedDocuments"
              />
              <Button
                icon="ti ti-plus"
                label="New document"
                text
                severity="secondary"
                size="small"
                @click="startNewDocument"
              />
              <Button
                icon="ti ti-folder-minus"
                label="Delete collection"
                text
                severity="danger"
                size="small"
                :disabled="!canWrite || isRunningQuery || isSavingDocument"
                @click="confirmDeleteCollection"
              />
            </div>
          </div>

          <div class="grid min-h-0 grid-cols-3 gap-3 px-3 pb-3">
            <div class="min-w-0">
              <div class="mb-2 text-xs uppercase tracking-[0.14em] opacity-50 mono">Filter</div>
              <JsonEditor
                v-model="filterJson"
                :height="`${queryHeight}px`"
                class="w-full"
                placeholder="{\n}"
                @submit="runQuery()"
              />
            </div>
            <div class="min-w-0">
              <div class="mb-2 text-xs uppercase tracking-[0.14em] opacity-50 mono">Sort</div>
              <JsonEditor
                v-model="sortJson"
                :height="`${queryHeight}px`"
                class="w-full"
                placeholder="{\n}"
                @submit="runQuery()"
              />
            </div>
            <div class="min-w-0">
              <div class="mb-2 text-xs uppercase tracking-[0.14em] opacity-50 mono">Projection</div>
              <JsonEditor
                v-model="projectionJson"
                :height="`${queryHeight}px`"
                class="w-full"
                placeholder="{\n}"
                @submit="runQuery()"
              />
            </div>
          </div>
        </CollapsiblePanel>

        <ResizeKnob
          v-if="queryVisible"
          v-model:height="queryHeight"
          direction="vertical"
          :min-height="110"
          :max-height="560"
          class="border-b app-border"
        />

        <CollapsiblePanel
          v-model:expanded="resultsVisible"
          :root-class="
            resultsVisible
              ? 'border-b app-border min-h-0 flex flex-1 flex-col'
              : 'border-b app-border shrink-0'
          "
          body-class="border-t app-border min-h-0 h-full flex-1 overflow-hidden"
        >
          <template #title>
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Documents</span>
          </template>

          <template #meta>
            <span v-if="resultSummary" class="text-xs opacity-55 mono">{{ resultSummary }}</span>
          </template>

          <template #actions>
            <DataExportButton
              :file-base-name="`${props.data.sourceName}-${databaseName}-${collectionName}`"
              :table-name="collectionName"
              :columns="exportColumns"
              :rows="exportRows"
              :disabled="!rows.length || isRunningQuery"
            />
            <Button
              icon="ti ti-plus"
              label="Add document"
              text
              severity="secondary"
              size="small"
              :disabled="!canWrite || isRunningQuery || isSavingDocument"
              @click="startNewDocument"
            />
          </template>

          <div class="relative min-h-0 h-full">
            <div class="min-h-0 flex h-full overflow-hidden">
              <div class="min-h-0 min-w-0 flex-1">
                <MongoDbResultsTable
                  ref="resultsTable"
                  v-model:columns="columns"
                  v-model:rows="rows"
                  v-model:focused-row-index="focusedRowIndex"
                  :result="result"
                  :loading="isRunningQuery"
                  class="h-full"
                />
              </div>

              <ResizeKnob
                v-model:width="viewerWidth"
                :min-width="280"
                :max-width="760"
                invert
                class="border-r app-border"
              />

              <div :style="{ width: `${viewerWidth}px` }" class="min-h-0 min-w-0 shrink-0">
                <MongoDbDocumentViewer
                  v-model="documentJson"
                  :mode="documentViewerMode"
                  :selected-label="selectedDocumentLabel"
                  :can-write="canWrite"
                  :can-save="canSaveCurrentDocument"
                  :can-delete="canDeleteCurrentDocument"
                  :loading="isSavingDocument"
                  class="h-full"
                  @save="saveDocument"
                  @reset="resetDocumentViewer"
                  @create-new="startNewDocument"
                  @delete-document="deleteCurrentViewerDocument"
                />
              </div>
            </div>

            <div
              v-if="result"
              class="pointer-events-none absolute bottom-6 left-[50%] translate-x-[-50%]"
            >
              <div class="pointer-events-auto">
                <DataPaginationBar
                  :page="currentPage"
                  :page-size="limit"
                  :total-pages="pageCount"
                  :summary="paginationSummary"
                  :disabled="isRunningQuery || isSavingDocument"
                  :can-previous="canGoToPreviousPage"
                  :can-next="canGoToNextPage"
                  @update:page="changePage"
                  @update:page-size="changePageSize"
                />
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        <ResizeKnob
          v-if="logsVisible && logs.length"
          v-model:height="logsHeight"
          direction="vertical"
          :min-height="120"
          :max-height="320"
          class="border-t app-border"
        />

        <CollapsiblePanel
          v-if="logs.length"
          v-model:expanded="logsVisible"
          root-class="border-t app-border shrink-0"
          body-class="border-t app-border"
        >
          <template #title>
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Logs</span>
          </template>

          <template #meta>
            <span class="text-xs opacity-50 mono"
              >{{ logs.length }} entr{{ logs.length === 1 ? 'y' : 'ies' }}</span
            >
          </template>

          <div :style="{ height: `${logsHeight}px` }">
            <SQLActivityPanel
              :entries="logs"
              empty-message="No MongoDB logs yet."
              flat
              hide-header
              class="h-full"
            />
          </div>
        </CollapsiblePanel>
      </div>
    </template>

    <MongoDbCreateCollectionDialog
      v-model:visible="createCollectionVisible"
      :database="databaseName"
      @create="createCollection"
    />
  </div>
</template>
