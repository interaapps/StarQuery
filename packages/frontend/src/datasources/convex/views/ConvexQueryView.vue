<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import GenericQueryView from '@/datasources/shared/components/GenericQueryView.vue'
import JsonEditor from '@/components/editors/JsonEditor.vue'
import { buildConvexQueryResultTables, summarizeConvexValue } from '@/datasources/convex/query'
import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourceReadPermissionTargets, dataSourceWritePermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import type { ConvexQueryResponse } from '@/types/convex'
import type { ConvexFunctionType, ConvexQueryTabData } from '@/types/query-console'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'

const props = defineProps<{
  data: ConvexQueryTabData
}>()

const authStore = useAuthStore()
const client = createBackendClient(props.data.serverUrl)

const functionTypeOptions: Array<{ label: string; value: ConvexFunctionType }> = [
  { label: 'Query', value: 'query' },
  { label: 'Mutation', value: 'mutation' },
  { label: 'Action', value: 'action' },
]

const isRunning = ref(false)
const functionType = ref<ConvexFunctionType>(props.data.initialFunctionType ?? 'query')
const functionPath = ref(props.data.initialPath ?? '')
const argsJson = ref(JSON.stringify(props.data.initialArgs ?? {}, null, 2))
const lastResponse = ref<ConvexQueryResponse | null>(null)
const logs = ref<SQLActivityEntry[]>([])

const canRunQuery = computed(() =>
  functionType.value === 'query'
    ? authStore.hasPermission(
        dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
      )
    : authStore.hasPermission(
        dataSourceWritePermissionTargets(props.data.projectId, props.data.sourceId),
      ),
)
const runButtonLabel = computed(() => `Run ${functionType.value}`)
const resultTables = computed<GenericQueryResultTable[]>(() =>
  lastResponse.value ? buildConvexQueryResultTables(lastResponse.value, props.data.sourceName) : [],
)
const hasOutput = computed(() => resultTables.value.length > 0)

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pushLogs(nextLogs: SQLActivityEntry[]) {
  logs.value = nextLogs
}

function parseArgs() {
  const parsed = JSON.parse(argsJson.value)
  if (!isRecord(parsed)) {
    throw new Error('Arguments must be a JSON object.')
  }

  argsJson.value = JSON.stringify(parsed, null, 2)
  return parsed
}

async function runFunction() {
  if (!canRunQuery.value) {
    pushLogs([
      {
        id: `convex-permission-${Date.now()}`,
        level: 'error',
        title: 'Permission required',
        message: `This server account is not allowed to run Convex ${functionType.value}s on this datasource.`,
      },
    ])
    return
  }

  const trimmedPath = functionPath.value.trim()
  if (!trimmedPath) {
    pushLogs([
      {
        id: `convex-path-${Date.now()}`,
        level: 'error',
        title: 'Function path required',
        message: 'Enter a Convex function path like messages:list before running the request.',
      },
    ])
    return
  }

  let args: Record<string, unknown>
  try {
    args = parseArgs()
  } catch (error) {
    pushLogs([
      {
        id: `convex-args-${Date.now()}`,
        level: 'error',
        title: 'Invalid arguments JSON',
        message: getErrorMessage(error, 'The Convex arguments JSON is invalid'),
      },
    ])
    return
  }

  isRunning.value = true
  const startedAt = performance.now()

  try {
    const response = (
      await client.post(
        `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/convex/query`,
        {
          functionType: functionType.value,
          path: trimmedPath,
          args,
        },
      )
    ).data as ConvexQueryResponse

    lastResponse.value = response
    pushLogs([
      {
        id: `convex-success-${Date.now()}`,
        level: 'success',
        title: `${response.functionType} executed`,
        message: summarizeConvexValue(response.value),
        sql: `${response.functionType.toUpperCase()} ${response.path}\n${JSON.stringify(response.args, null, 2)}`,
        durationMs: Math.round(performance.now() - startedAt),
      },
      ...response.logLines.map((line, index) => ({
        id: `convex-log-${Date.now()}-${index}`,
        level: 'info' as const,
        title: 'Convex log',
        message: line,
      })),
    ])
  } catch (error) {
    lastResponse.value = null
    pushLogs([
      {
        id: `convex-error-${Date.now()}`,
        level: 'error',
        title: `${functionType.value} failed`,
        message: getErrorMessage(error, 'The Convex function could not be executed'),
        sql: `${functionType.value.toUpperCase()} ${trimmedPath}\n${JSON.stringify(args, null, 2)}`,
        durationMs: Math.round(performance.now() - startedAt),
      },
    ])
  } finally {
    isRunning.value = false
  }
}
</script>

<template>
  <GenericQueryView
    :source-name="props.data.sourceName"
    console-label="Convex Console"
    :run-button-label="runButtonLabel"
    :run-button-disabled="!canRunQuery"
    :is-running="isRunning"
    :warning-message="
      !canRunQuery
        ? `This server account can open the console but cannot run Convex ${functionType}s on this datasource.`
        : null
    "
    editor-title="Function"
    :result-tables="resultTables"
    :has-output="hasOutput"
    empty-state-message="Run a Convex query, mutation, or action to inspect the returned value here."
    :logs="logs"
    empty-log-message="No Convex logs yet."
    @run="runFunction"
  >
    <template #editor="{ height }">
      <div class="h-full min-h-0 flex flex-col" :style="{ height }">
        <div class="border-b app-border px-3 py-2 grid grid-cols-[10rem_minmax(0,1fr)] gap-3">
          <Select
            v-model="functionType"
            :options="functionTypeOptions"
            option-label="label"
            option-value="value"
            size="small"
            fluid
          />
          <InputText
            v-model="functionPath"
            size="small"
            fluid
            placeholder="messages:list"
            @keydown.enter.prevent="runFunction"
          />
        </div>

        <div class="min-h-0 flex-1">
          <JsonEditor
            v-model="argsJson"
            height="100%"
            min-height="100%"
            placeholder="{\n}"
            @submit="runFunction"
          />
        </div>
      </div>
    </template>
  </GenericQueryView>
</template>
