<script setup lang="ts">
import { computed, ref } from 'vue'
import Textarea from 'primevue/textarea'
import GenericQueryView from '@/datasources/shared/components/GenericQueryView.vue'
import { buildRedisQueryResultTables, summarizeRedisReply } from '@/datasources/redis/query'
import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourceReadPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import type { RedisQueryTabData } from '@/types/query-console'
import type { RedisQueryResponse } from '@/types/redis'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'

const props = defineProps<{
  data: RedisQueryTabData
}>()

const authStore = useAuthStore()
const client = createBackendClient(props.data.serverUrl)

const isRunning = ref(false)
const command = ref(props.data.initialCommand ?? 'SCAN 0 MATCH * COUNT 100')
const lastResponse = ref<RedisQueryResponse | null>(null)
const logs = ref<SQLActivityEntry[]>([])

const canRunQuery = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const resultTables = computed<GenericQueryResultTable[]>(() =>
  lastResponse.value ? buildRedisQueryResultTables(lastResponse.value, props.data.sourceName) : [],
)
const hasOutput = computed(() => resultTables.value.length > 0)

function pushLog(entry: Omit<SQLActivityEntry, 'id'>) {
  logs.value = [
    {
      id: `${entry.level}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...entry,
    },
    ...logs.value,
  ].slice(0, 20)
}

async function runCommand() {
  if (!canRunQuery.value) {
    pushLog({
      level: 'error',
      title: 'Permission required',
      message: 'This server account is not allowed to run Redis commands on this datasource.',
    })
    return
  }

  isRunning.value = true
  const startedAt = performance.now()

  try {
    const response = (
      await client.post(
        `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/redis/query`,
        {
          command: command.value,
        },
      )
    ).data as RedisQueryResponse

    lastResponse.value = response
    pushLog({
      level: 'success',
      title: `${response.commandName} executed`,
      message: summarizeRedisReply(response.reply),
      sql: response.command,
      durationMs: Math.round(performance.now() - startedAt),
    })
  } catch (error) {
    lastResponse.value = null
    pushLog({
      level: 'error',
      title: 'Command failed',
      message: getErrorMessage(error, 'The Redis command could not be executed'),
      sql: command.value.trim() || undefined,
      durationMs: Math.round(performance.now() - startedAt),
    })
  } finally {
    isRunning.value = false
  }
}

function onEditorKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    void runCommand()
  }
}
</script>

<template>
  <GenericQueryView
    :source-name="props.data.sourceName"
    console-label="Redis Console"
    run-button-label="Run command"
    :run-button-disabled="!canRunQuery"
    :is-running="isRunning"
    :warning-message="
      !canRunQuery
        ? 'This server account can open the console but cannot run Redis commands on this datasource.'
        : null
    "
    editor-title="Command"
    :result-tables="resultTables"
    :has-output="hasOutput"
    empty-state-message="Run a Redis command to inspect the reply here."
    :logs="logs"
    empty-log-message="No Redis command logs yet."
    @run="runCommand"
  >
    <template #editor="{ height }">
      <div class="px-3 py-3 h-full">
        <Textarea
          v-model="command"
          auto-resize
          fluid
          class="h-full w-full mono text-sm"
          :style="{ minHeight: height, height }"
          placeholder="SCAN 0 MATCH user:* COUNT 100"
          @keydown="onEditorKeydown"
        />
      </div>
    </template>
  </GenericQueryView>
</template>
