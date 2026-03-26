<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { SQLNamespace } from '@codemirror/lang-sql'
import { useToast } from 'primevue/usetoast'
import { loadSqlCompletionCatalog } from '@/datasources/shared-sql/completion'
import { splitSqlStatements } from '@/datasources/shared-sql/statements'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import GenericQueryView from '@/datasources/shared/components/GenericQueryView.vue'
import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourceReadPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { SQLExecutionResult, SQLQueryTabData } from '@/types/sql'

const props = defineProps<{
  data: SQLQueryTabData
}>()

const toast = useToast()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()
const client = createBackendClient(props.data.serverUrl)

const isRunning = ref(false)
const query = ref(props.data.initialQuery ?? `SELECT * FROM `)
const results = ref<SQLExecutionResult[]>([])
const logs = ref<SQLActivityEntry[]>([])
const completionSchema = ref<SQLNamespace>()
const completionDefaultSchema = ref<string>()

const isSelectResult = (
  result: SQLExecutionResult,
): result is Extract<SQLExecutionResult, { type: 'SELECT' }> => result.type === 'SELECT'

const resultSets = computed(() => results.value.filter(isSelectResult))
const hasOutput = computed(() => results.value.length > 0)
const resultTables = computed<GenericQueryResultTable[]>(() =>
  resultSets.value.map((result, index) => ({
    id: `result-${index + 1}`,
    title: `Result ${index + 1}`,
    kind: result.type,
    columns: result.columns,
    rows: result.rows,
    exportFileBaseName: `${props.data.sourceName}-result-${index + 1}`,
    exportTableName: `result_${index + 1}`,
  })),
)
const sourceRecord = computed(() =>
  workspaceStore.dataSources.find((source) => source.id === props.data.sourceId),
)
const sourceType = computed(() => props.data.sourceType ?? sourceRecord.value?.type ?? 'mysql')
const canRunQuery = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)

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
  if (!canRunQuery.value) {
    logs.value = [
      {
        id: `log-permission-${Date.now()}`,
        level: 'error',
        title: 'Permission required',
        message: 'This server account is not allowed to run SQL against this datasource.',
      },
    ]
    return
  }

  isRunning.value = true
  const startedAt = performance.now()

  try {
    const statements = splitSqlStatements(query.value)
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
      const statementSql = statements[index] ?? query.value.trim()
      if (result.type === 'SELECT') {
        return {
          id: `log-${index}`,
          statement: index + 1,
          level: 'info',
          title: 'Result set returned',
          message: `${result.rows.length} row(s) returned`,
          sql: statementSql,
          durationMs,
        } satisfies SQLActivityEntry
      }

      return {
        id: `log-${index}`,
        statement: index + 1,
        level: 'success',
        title: 'Statement executed',
        message: `${result.result?.affectedRows ?? 0} row(s) affected`,
        sql: statementSql,
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
        sql: query.value.trim() || undefined,
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
  <GenericQueryView
    :source-name="props.data.sourceName"
    console-label="SQL Console"
    run-button-label="Run query"
    :run-button-disabled="!canRunQuery"
    :is-running="isRunning"
    :warning-message="
      !canRunQuery
        ? 'This server account can open the console but cannot run SQL on this datasource.'
        : null
    "
    editor-title="Editor"
    :result-tables="resultTables"
    :has-output="hasOutput"
    empty-state-message="Run a query from the selected datasource to inspect one or more result sets here."
    :logs="logs"
    empty-log-message="No query logs yet."
    @run="runQuery"
  >
    <template #editor="{ height }">
      <SQLEditor
        v-model="query"
        multiline
        :height="height"
        :source-type="sourceType"
        :schema="completionSchema"
        :default-schema="completionDefaultSchema"
        class="w-full"
        @submit="runQuery"
      />
    </template>
  </GenericQueryView>
</template>
