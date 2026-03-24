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
import ResizeKnob from '@/components/ResizeKnob.vue'
import ElasticsearchResultsTable from '@/components/datasources/elasticsearch/ElasticsearchResultsTable.vue'
import JsonEditor from '@/components/editors/JsonEditor.vue'
import SQLActivityPanel, { type SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourcePermissionTargets } from '@/services/permissions'
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
const logsVisible = ref(true)
const logsHeight = ref(160)
const editorVisible = ref(true)
const requestPlaceholder = `{
  "from": 0,
  "size": 10,
  "track_total_hits": true,
  "query": {
    "match_all": {}
  }
}`

const canSearch = computed(() =>
  authStore.hasPermission([
    ...dataSourcePermissionTargets(props.data.projectId, props.data.sourceId, 'query', 'read'),
    ...dataSourcePermissionTargets(props.data.projectId, props.data.sourceId, 'view', 'read'),
    ...dataSourcePermissionTargets(props.data.projectId, props.data.sourceId, 'manage', 'write'),
  ]),
)
const canEditDocuments = computed(() =>
  authStore.hasPermission([
    ...dataSourcePermissionTargets(props.data.projectId, props.data.sourceId, 'query', 'write'),
    ...dataSourcePermissionTargets(props.data.projectId, props.data.sourceId, 'manage', 'write'),
  ]),
)
const hasSelectedIndex = computed(() => Boolean(selectedIndex.value))
const hasPendingChanges = computed(() => rows.value.some((row) => row.state !== 'clean'))

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
    toast.add({
      severity: 'error',
      summary: 'Invalid JSON',
      detail,
      life: 2600,
    })
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
    toast.add({
      severity: 'error',
      summary: 'Search failed',
      detail,
      life: 3000,
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
    toast.add({
      severity: 'success',
      summary: 'Documents saved',
      detail: `Saved changes to ${selectedIndex.value}`,
      life: 2200,
    })
    await runSearchForIndex()
  } catch (error) {
    const detail = getErrorMessage(error, 'The Elasticsearch documents could not be saved')
    pushLog({
      level: 'error',
      title: `Save failed on ${selectedIndex.value}`,
      message: detail,
    })
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail,
      life: 3200,
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
      <div class="border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Elasticsearch</div>
          <div class="truncate text-sm mt-1">
            {{ selectedIndex || 'No index selected' }}
          </div>
          <div class="text-xs opacity-55 mt-1 truncate">
            {{ props.data.sourceName }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Button
            icon="ti ti-refresh"
            text
            severity="secondary"
            :disabled="!hasSelectedIndex || isSaving"
            @click="runSearchForIndex()"
          />
          <Button
            :icon="`ti ti-player-play ${isRunningSearch ? 'animate-pulse' : ''}`"
            label="Run search"
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
        <div class="border-b border-neutral-200 dark:border-neutral-800">
          <div class="px-3 py-2 flex items-center justify-between">
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Request Body</span>
            <Button
              :icon="`ti ${editorVisible ? 'ti-minus' : 'ti-plus'}`"
              size="small"
              text
              severity="secondary"
              @click="editorVisible = !editorVisible"
            />
          </div>

          <div v-if="editorVisible" class="border-t border-neutral-200 dark:border-neutral-800">
            <div class="grid grid-cols-[repeat(3,minmax(0,10rem))_auto_auto_1fr] gap-3 px-3 py-3 items-end">
              <div class="flex flex-col gap-2">
                <label class="text-sm opacity-70">From</label>
                <InputNumber v-model="from" fluid :min="0" :use-grouping="false" />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm opacity-70">Size</label>
                <InputNumber v-model="size" fluid :min="1" :max="1000" :use-grouping="false" />
              </div>
              <div class="flex items-center gap-3 pt-7">
                <ToggleSwitch v-model="trackTotalHits" input-id="elasticsearch-track-total-hits" />
                <label for="elasticsearch-track-total-hits" class="text-sm opacity-70">Track total hits</label>
              </div>
              <Button label="Format JSON" icon="ti ti-braces" outlined size="small" @click="formatRequestBody" />
              <Button label="Reset" icon="ti ti-restore" text severity="secondary" size="small" @click="resetRequestBody" />
            </div>

            <JsonEditor
              v-model="requestBody"
              :height="`${editorHeight}px`"
              :placeholder="requestPlaceholder"
              class="w-full"
              @submit="runSearchForIndex()"
            />
          </div>
        </div>

        <ResizeKnob
          v-if="editorVisible"
          v-model:height="editorHeight"
          direction="vertical"
          :min-height="180"
          :max-height="680"
          class="border-b border-neutral-200 dark:border-neutral-800"
        />

        <div class="border-b border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Results</span>
            <span v-if="resultSummary" class="text-xs opacity-55 mono">
              {{ resultSummary.returned }} returned
              <template v-if="resultSummary.total !== null"> / {{ resultSummary.total }} total</template>
              <template v-if="resultSummary.tookMs !== null"> • {{ resultSummary.tookMs }} ms</template>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <Button
              icon="ti ti-plus"
              label="Add"
              size="small"
              text
              severity="secondary"
              :disabled="!canEditDocuments || !result || isRunningSearch || isSaving"
              @click="addDocument"
            />
            <Button
              icon="ti ti-trash"
              label="Delete"
              size="small"
              text
              severity="danger"
              :disabled="!canEditDocuments || !result || isRunningSearch || isSaving"
              @click="deleteDocuments"
            />
            <Button
              icon="ti ti-restore"
              label="Discard"
              size="small"
              text
              severity="secondary"
              :disabled="!hasPendingChanges || isRunningSearch || isSaving"
              @click="discardDocumentChanges"
            />
            <Button
              icon="ti ti-device-floppy"
              label="Save"
              size="small"
              :loading="isSaving"
              :disabled="!canEditDocuments || !hasPendingChanges || isRunningSearch"
              @click="saveDocuments"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden">
          <div class="h-full p-3">
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
        </div>

        <ResizeKnob
          v-if="logsVisible && logs.length"
          v-model:height="logsHeight"
          direction="vertical"
          :min-height="120"
          :max-height="320"
          class="border-t border-neutral-200 dark:border-neutral-800"
        />

        <div
          v-if="logs.length && logsVisible"
          :style="{ height: `${logsHeight}px` }"
          class="border-t border-neutral-200 dark:border-neutral-800"
        >
          <SQLActivityPanel :entries="logs" empty-message="No Elasticsearch logs yet." flat class="h-full">
            <template #actions>
              <Button
                icon="ti ti-minus"
                size="small"
                text
                severity="secondary"
                @click="logsVisible = false"
              />
            </template>
          </SQLActivityPanel>
        </div>
        <div
          v-else-if="logs.length && !logsVisible"
          class="border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between"
        >
          <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Logs</span>
          <Button
            icon="ti ti-plus"
            size="small"
            text
            severity="secondary"
            @click="logsVisible = true"
          />
        </div>
      </template>
    </div>
  </div>
</template>
