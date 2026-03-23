<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { SQLNamespace } from '@codemirror/lang-sql'
import Button from 'primevue/button'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import ResizeKnob from '@/components/ResizeKnob.vue'
import SQLActivityPanel, { type SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { loadSqlCompletionCatalog } from '@/services/sql-completion'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type {
  SQLExecutionResult,
  SQLQueryTabData,
  SQLTableColumn,
  SQLTableRowDraft,
} from '@/types/sql'

const props = defineProps<{
  data: SQLQueryTabData
}>()

const toast = useToast()
const workspaceStore = useWorkspaceStore()
const client = createBackendClient(props.data.serverUrl)

const isRunning = ref(false)
const query = ref(props.data.initialQuery ?? `SELECT * FROM `)
const results = ref<SQLExecutionResult[]>([])
const editorHeight = ref(320)
const logs = ref<SQLActivityEntry[]>([])
const editorVisible = ref(true)
const logsVisible = ref(true)
const completionSchema = ref<SQLNamespace>()
const completionDefaultSchema = ref<string>()

const buildRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => ({
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    values: row,
    original: row,
    state: 'clean' as const,
  }))

const toColumns = (columns: string[]): SQLTableColumn[] =>
  columns.map((column) => ({
    name: column,
    field: column,
  }))

const resultSets = computed(() => results.value.filter((result) => result.type === 'SELECT'))
const hasOutput = computed(() => results.value.length > 0)
const sourceRecord = computed(() => workspaceStore.dataSources.find((source) => source.id === props.data.sourceId))
const sourceType = computed(() => props.data.sourceType ?? sourceRecord.value?.type ?? 'mysql')

const loadCompletion = async () => {
  if (!sourceRecord.value) return

  try {
    const catalog = await loadSqlCompletionCatalog({
      client,
      projectId: props.data.projectId,
      sourceId: props.data.sourceId,
      source: sourceRecord.value,
    })
    completionSchema.value = catalog.schema
    completionDefaultSchema.value = catalog.defaultSchema
  } catch {
    completionSchema.value = undefined
    completionDefaultSchema.value = undefined
  }
}

const runQuery = async () => {
  isRunning.value = true
  const startedAt = performance.now()

  try {
    const response = (
      await client.post(
        `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/query`,
        {
          query: query.value,
        },
      )
    ).data as { results: SQLExecutionResult[] }

    results.value = response.results
    const durationMs = Math.round(performance.now() - startedAt)
    logs.value = response.results.map((result, index) => {
      if (result.type === 'SELECT') {
        return {
          id: `log-${index}`,
          statement: index + 1,
          level: 'info',
          title: 'Result set returned',
          message: `${result.rows.length} row(s) returned`,
          durationMs,
        } satisfies SQLActivityEntry
      }

      return {
        id: `log-${index}`,
        statement: index + 1,
        level: 'success',
        title: 'Statement executed',
        message: `${result.result?.affectedRows ?? 0} row(s) affected`,
        durationMs,
      } satisfies SQLActivityEntry
    })

    toast.add({
      severity: 'success',
      summary: 'Query finished',
      detail: `${response.results.length} statement result(s) returned`,
      life: 1800,
    })
  } catch (error) {
    const detail = getErrorMessage(error, 'The SQL query could not be executed')
    const durationMs = Math.round(performance.now() - startedAt)
    results.value = []
    logs.value = [
      {
        id: `log-error-${Date.now()}`,
        level: 'error',
        title: 'Query failed',
        message: detail,
        durationMs,
      },
    ]

    toast.add({
      severity: 'error',
      summary: 'Query failed',
      detail,
      life: 2600,
    })
  } finally {
    isRunning.value = false
  }
}

onMounted(async () => {
  await loadCompletion()
})

watch(sourceRecord, async (nextSource) => {
  if (!nextSource) return
  await loadCompletion()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-3 py-2"
    >
      <div class="flex items-center gap-3">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">{{
          props.data.sourceName
        }}</span>
        <span class="text-xs uppercase tracking-[0.16em] opacity-40 mono">SQL Console</span>
      </div>

      <Button
        :icon="`ti ti-player-play ${isRunning ? 'animate-pulse' : ''}`"
        label="Run query"
        :loading="isRunning"
        @click="runQuery"
        size="small"
      />
    </div>

    <div class="border-b border-neutral-200 dark:border-neutral-800">
      <div class="px-3 py-2 flex items-center justify-between">
        <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Editor</span>
        <Button
          :icon="`ti ${editorVisible ? 'ti-minus' : 'ti-plus'}`"
          size="small"
          text
          severity="secondary"
          @click="editorVisible = !editorVisible"
        />
      </div>

      <div v-if="editorVisible" class="overflow-hidden">
        <SQLEditor
          v-model="query"
          multiline
          :height="`${editorHeight}px`"
          :source-type="sourceType"
          :schema="completionSchema"
          :default-schema="completionDefaultSchema"
          class="w-full"
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

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="!hasOutput" class="h-full flex flex-col">
        <div v-if="logs.length && logsVisible" class="min-h-0 flex-1">
          <SQLActivityPanel :entries="logs" empty-message="No query logs yet." flat class="h-full">
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
        <Message v-else severity="secondary" :closable="false">
          Run a query from the selected datasource to inspect one or more result sets here.
        </Message>
      </div>

      <div v-else class="h-full flex flex-col gap-4">
        <div v-if="resultSets.length" class="min-h-0 flex-1 overflow-auto flex flex-col gap-4 px-3 py-3 pr-4">
          <section
            v-for="(result, index) in resultSets"
            :key="index"
            class="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shrink-0"
          >
            <div
              class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between"
            >
              <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">
                Result {{ index + 1 }}
              </span>
              <span class="text-xs opacity-50 mono">{{ result.type }}</span>
            </div>

            <div class="h-[20rem] overflow-hidden">
              <ExtendedDataTable
                :columns="toColumns(result.columns)"
                :rows="buildRows(result.rows)"
                :can-edit="false"
              />
            </div>
          </section>
        </div>

        <section v-if="logs.length && logsVisible" class="border-t border-neutral-200 dark:border-neutral-800 shrink-0">
          <SQLActivityPanel
            :entries="logs"
            empty-message="No query logs yet."
            flat
            class="h-[12rem]"
          >
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
        </section>

        <div
          v-else-if="logs.length && !logsVisible"
          class="border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between shrink-0"
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
      </div>
    </div>
  </div>
</template>
