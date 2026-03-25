<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import {
  applyElasticsearchRequestControls,
  DEFAULT_ELASTICSEARCH_QUERY,
  extractElasticsearchIndexFromPath,
  parseElasticsearchQuery,
  runElasticsearchSearch,
  saveElasticsearchDocuments,
} from '@/datasources/elasticsearch/browser'
import CollapsiblePanel from '@/components/common/CollapsiblePanel.vue'
import DataExportButton from '@/components/common/DataExportButton.vue'
import DataPaginationBar from '@/components/common/DataPaginationBar.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import ElasticsearchResultsTable from '@/components/datasources/elasticsearch/ElasticsearchResultsTable.vue'
import JsonEditor from '@/components/editors/JsonEditor.vue'
import SQLActivityPanel, { type SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import {
  dataSourceReadPermissionTargets,
  dataSourceWritePermissionTargets,
} from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import type { DataSourceBrowserTabData, ElasticsearchSearchResult } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = defineProps<{
  data: DataSourceBrowserTabData
}>()

const toast = useToast()
const authStore = useAuthStore()
const client = createBackendClient(props.data.serverUrl)
const resultsTable = useTemplateRef<InstanceType<typeof ElasticsearchResultsTable>>('resultsTable')

const selectedIndex = ref('')
const requestBody = ref(DEFAULT_ELASTICSEARCH_QUERY)
const isRunningSearch = ref(false)
const isSaving = ref(false)
const result = ref<ElasticsearchSearchResult | null>(null)
const columns = ref<SQLTableColumn[]>([])
const rows = ref<SQLTableRowDraft[]>([])
const editorHeight = ref(220)
const from = ref(0)
const size = ref(10)
const trackTotalHits = ref(true)
const logs = ref<SQLActivityEntry[]>([])
const logsVisible = ref(false)
const logsHeight = ref(160)
const editorVisible = ref(true)
const resultsVisible = ref(true)
const requestPlaceholder = `{
  "from": 0,
  "size": 10,
  "track_total_hits": true,
  "query": {
    "match_all": {}
  }
}`

const canSearch = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const canEditDocuments = computed(() =>
  authStore.hasPermission(
    dataSourceWritePermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const hasSelectedIndex = computed(() => Boolean(selectedIndex.value))
const hasPendingChanges = computed(() => rows.value.some((row) => row.state !== 'clean'))
const currentPage = computed(() => Math.floor(from.value / Math.max(size.value, 1)) + 1)
const pageCount = computed(() =>
  result.value?.total !== null && result.value?.total !== undefined
    ? Math.max(1, Math.ceil(result.value.total / Math.max(size.value, 1)))
    : null,
)
const canGoToPreviousPage = computed(() => from.value > 0)
const canGoToNextPage = computed(() => {
  if (!result.value) {
    return false
  }

  if (result.value.total !== null) {
    return from.value + size.value < result.value.total
  }

  return result.value.hits.length >= size.value
})
const paginationSummary = computed(() => {
  if (!result.value) {
    return null
  }

  if (result.value.total !== null) {
    return `${result.value.total} hit${result.value.total === 1 ? '' : 's'}`
  }

  return `${result.value.hits.length} loaded`
})

const resultSummary = computed(() => {
  if (!result.value) {
    return null
  }

  return {
    returned: result.value.hits.length,
    total: result.value.total,
    tookMs: result.value.tookMs,
  }
})
const exportColumns = computed(() => columns.value.map((column) => column.field))
const exportRows = computed(() =>
  rows.value.filter((row) => row.state !== 'deleted').map((row) => ({ ...row.values })),
)

function pushLog(entry: Omit<SQLActivityEntry, 'id'>) {
  logs.value = [
    {
      id: `${entry.level}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...entry,
    },
    ...logs.value,
  ].slice(0, 20)
}

function syncRequestControlsIntoBody(options?: { silent?: boolean }) {
  try {
    requestBody.value = JSON.stringify(
      applyElasticsearchRequestControls(parseElasticsearchQuery(requestBody.value), {
        from: from.value,
        size: size.value,
        trackTotalHits: trackTotalHits.value,
      }),
      null,
      2,
    )
  } catch (error) {
    if (!options?.silent) {
      throw error
    }

    // Keep the user's invalid draft untouched until they fix it.
  }
}

async function runSearchForIndex(index = selectedIndex.value) {
  if (!index) {
    result.value = null
    return
  }

  if (!canSearch.value) {
    pushLog({
      level: 'error',
      title: 'Permission required',
      message: 'This server account is not allowed to query this Elasticsearch datasource.',
    })
    return
  }

  let parsedBody: Record<string, unknown>
  try {
    parsedBody = applyElasticsearchRequestControls(parseElasticsearchQuery(requestBody.value), {
      from: from.value,
      size: size.value,
      trackTotalHits: trackTotalHits.value,
    })
    requestBody.value = JSON.stringify(parsedBody, null, 2)
  } catch (error) {
    const detail = getErrorMessage(error, 'The Elasticsearch request body is invalid JSON')
    pushLog({
      level: 'error',
      title: 'Invalid JSON',
      message: detail,
    })
    logsVisible.value = true
    return
  }

  isRunningSearch.value = true

  try {
    const response = await runElasticsearchSearch({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      index,
      body: parsedBody,
      from: from.value,
      size: size.value,
      trackTotalHits: trackTotalHits.value,
    })

    result.value = response
    pushLog({
      level: 'success',
      title: `Search completed on ${index}`,
      message: `${response.hits.length} document(s) returned${response.total !== null ? ` out of ${response.total}` : ''}.`,
      durationMs: response.tookMs ?? undefined,
    })
  } catch (error) {
    const detail = getErrorMessage(error, 'The Elasticsearch search could not be executed')
    result.value = null
    pushLog({
      level: 'error',
      title: `Search failed on ${index}`,
      message: detail,
    })
  } finally {
    isRunningSearch.value = false
  }
}

async function saveDocuments() {
  if (!selectedIndex.value || !hasPendingChanges.value) {
    return
  }

  isSaving.value = true

  try {
    const response = await saveElasticsearchDocuments({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      index: selectedIndex.value,
      columns: columns.value,
      rows: rows.value,
    })

    pushLog({
      level: 'success',
      title: `Saved documents in ${selectedIndex.value}`,
      message: `${response.inserted} inserted, ${response.updated} updated, ${response.deleted} deleted.`,
      durationMs: response.tookMs ?? undefined,
    })
    await runSearchForIndex()
  } catch (error) {
    const detail = getErrorMessage(error, 'The Elasticsearch documents could not be saved')
    pushLog({
      level: 'error',
      title: `Save failed on ${selectedIndex.value}`,
      message: detail,
    })
  } finally {
    isSaving.value = false
  }
}

function addDocument() {
  resultsTable.value?.addRow()
}

function deleteDocuments() {
  resultsTable.value?.deleteSelectedRows()
}

function discardDocumentChanges() {
  resultsTable.value?.resetFromResult()
}

function guardPendingChanges() {
  if (!hasPendingChanges.value) {
    return false
  }

  const message = 'Save or discard your current result set before changing pagination.'
  pushLog({
    level: 'info',
    title: 'Unsaved changes',
    message,
  })
  return true
}

async function changePage(nextPage: number) {
  if (!selectedIndex.value) {
    return
  }

  if (guardPendingChanges()) {
    return
  }

  const boundedPage =
    pageCount.value !== null
      ? Math.min(Math.max(nextPage, 1), pageCount.value)
      : Math.max(nextPage, 1)

  from.value = (boundedPage - 1) * size.value
  await runSearchForIndex()
}

async function changePageSize(nextPageSize: number) {
  if (!selectedIndex.value) {
    return
  }

  if (guardPendingChanges()) {
    return
  }

  size.value = nextPageSize
  from.value = 0
  await runSearchForIndex()
}

function formatRequestBody() {
  try {
    syncRequestControlsIntoBody()
  } catch (error) {
    const detail = getErrorMessage(error, 'The Elasticsearch request body is invalid JSON')
    toast.add({
      severity: 'error',
      summary: 'Format failed',
      detail,
      life: 2600,
    })
  }
}

function resetRequestBody() {
  requestBody.value = DEFAULT_ELASTICSEARCH_QUERY
  from.value = 0
  size.value = 10
  trackTotalHits.value = true
}

watch(
  () => props.data.path,
  (nextPath) => {
    selectedIndex.value = extractElasticsearchIndexFromPath(nextPath)
    if (!selectedIndex.value) {
      result.value = null
      columns.value = []
      rows.value = []
    }
  },
  { immediate: true },
)

watch([from, size, trackTotalHits], () => {
  syncRequestControlsIntoBody({ silent: true })
})

watch(
  [selectedIndex, canSearch],
  async ([nextIndex, nextCanSearch], [previousIndex, previousCanSearch]) => {
    if (!nextIndex) {
      result.value = null
      return
    }

    if (!nextCanSearch || isRunningSearch.value) {
      return
    }

    if (nextIndex === previousIndex && nextCanSearch === previousCanSearch && result.value) {
      return
    }

    await runSearchForIndex(nextIndex)
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-full flex-col">
    <Message v-if="!canSearch" severity="warn" class="m-3 mb-0">
      This server account can open the datasource but cannot run Elasticsearch searches on it.
    </Message>

    <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
      <div class="border-b app-border px-3 py-2 flex items-center justify-between gap-3">
        <div class="min-w-0 space-y-0.5">
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Elasticsearch</div>
          <div class="truncate text-sm">
            {{ selectedIndex || 'No index selected' }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button
            size="small"
            icon="ti ti-refresh"
            text
            severity="secondary"
            :disabled="!hasSelectedIndex || isSaving"
            @click="runSearchForIndex()"
          />
          <Button
            :icon="`ti ti-player-play ${isRunningSearch ? 'animate-pulse' : ''}`"
            label="Run"
            size="small"
            :loading="isRunningSearch"
            :disabled="!selectedIndex || !canSearch || isSaving"
            @click="runSearchForIndex()"
          />
        </div>
      </div>

      <Message v-if="!hasSelectedIndex" severity="secondary" :closable="false" class="m-3 mb-0">
        Select an index from the sidebar to query it here.
      </Message>

      <template v-else>
        <CollapsiblePanel
          v-model:expanded="editorVisible"
          title="Request Body"
          root-class="border-b app-border"
          body-class="border-t app-border"
        >
          <template #title>
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Request Body</span>
          </template>

          <template #default>
            <div
              class="grid grid-cols-[repeat(3,minmax(0,10rem))_auto_auto_1fr] gap-3 px-3 py-3 items-end"
            >
              <div class="flex flex-col gap-2">
                <label class="text-sm opacity-70">From</label>
                <InputNumber v-model="from" fluid :min="0" :use-grouping="false" size="small" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm opacity-70">Size</label>
                <InputNumber
                  v-model="size"
                  fluid
                  :min="1"
                  :max="1000"
                  :use-grouping="false"
                  size="small"
                />
              </div>
              <div class="flex items-center gap-3 pt-7">
                <ToggleSwitch v-model="trackTotalHits" input-id="elasticsearch-track-total-hits" />
                <label for="elasticsearch-track-total-hits" class="text-sm opacity-70"
                  >Track total hits</label
                >
              </div>
              <Button
                label="Format JSON"
                icon="ti ti-braces"
                outlined
                size="small"
                @click="formatRequestBody"
              />
              <Button
                label="Reset"
                icon="ti ti-restore"
                text
                severity="secondary"
                size="small"
                @click="resetRequestBody"
              />
            </div>

            <JsonEditor
              v-model="requestBody"
              :height="`${editorHeight}px`"
              :placeholder="requestPlaceholder"
              class="w-full"
              @submit="runSearchForIndex()"
            />
          </template>
        </CollapsiblePanel>

        <ResizeKnob
          v-if="editorVisible"
          v-model:height="editorHeight"
          direction="vertical"
          :min-height="180"
          :max-height="680"
          class="border-b app-border"
        />

        <CollapsiblePanel
          v-model:expanded="resultsVisible"
          :root-class="
            resultsVisible
              ? 'border-b app-border min-h-0 flex flex-1 flex-col'
              : 'border-b app-border shrink-0'
          "
          body-class="border-t app-border min-h-0 flex-1 overflow-hidden"
        >
          <template #title>
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Results</span>
          </template>

          <template #meta>
            <span v-if="resultSummary" class="text-xs opacity-55 mono">
              {{ resultSummary.returned }} returned
              <template v-if="resultSummary.total !== null">
                / {{ resultSummary.total }} total</template
              >
              <template v-if="resultSummary.tookMs !== null">
                • {{ resultSummary.tookMs }} ms</template
              >
            </span>
          </template>

          <template #actions>
            <Button
              icon="ti ti-plus"
              aria-label="Add"
              size="small"
              text
              rounded
              severity="contrast"
              :disabled="!canEditDocuments || !result || isRunningSearch || isSaving"
              @click="addDocument"
            />
            <Button
              icon="ti ti-trash"
              aria-label="Delete"
              size="small"
              text
              severity="contrast"
              :disabled="!canEditDocuments || !result || isRunningSearch || isSaving"
              @click="deleteDocuments"
            />
            <Button
              icon="ti ti-restore"
              aria-label="Discard"
              v-tooltip="'Discard'"
              size="small"
              text
              rounded
              severity="contrast"
              :disabled="!hasPendingChanges || isRunningSearch || isSaving"
              @click="discardDocumentChanges"
            />
            <Button
              icon="ti ti-device-floppy"
              aria-label="Save"
              text
              rounded
              size="small"
              :loading="isSaving"
              :disabled="!canEditDocuments || !hasPendingChanges || isRunningSearch"
              @click="saveDocuments"
            />

            <DataExportButton
              :file-base-name="`${props.data.sourceName}-${selectedIndex || 'results'}`"
              :table-name="selectedIndex || 'results'"
              :columns="exportColumns"
              :rows="exportRows"
              :disabled="!result || isRunningSearch"
            />
          </template>

          <div class="relative h-full">
            <ElasticsearchResultsTable
              ref="resultsTable"
              v-model:columns="columns"
              v-model:rows="rows"
              :result="result"
              :can-edit="canEditDocuments"
              :loading="isRunningSearch"
              class="h-full"
            />
          </div>
          <div
            v-if="result"
            class="pointer-events-none absolute bottom-6 left-[50%] translate-x-[-50%]"
          >
            <div class="pointer-events-auto">
              <DataPaginationBar
                :page="currentPage"
                :page-size="size"
                :total-pages="pageCount"
                :summary="paginationSummary"
                :disabled="isRunningSearch || isSaving"
                :can-previous="canGoToPreviousPage"
                :can-next="canGoToNextPage"
                @update:page="changePage"
                @update:page-size="changePageSize"
              />
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
              empty-message="No Elasticsearch logs yet."
              flat
              hide-header
              class="h-full"
            />
          </div>
        </CollapsiblePanel>
      </template>
    </div>
  </div>
</template>
