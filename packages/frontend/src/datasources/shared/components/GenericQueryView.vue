<script setup lang="ts">
import { ref, useSlots } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import CollapsiblePanel from '@/components/common/CollapsiblePanel.vue'
import DataExportButton from '@/components/common/DataExportButton.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import CollapsibleActivityPanel from '@/components/sql/CollapsibleActivityPanel.vue'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import type { GenericQueryResultTable } from '@/datasources/shared/query-view'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = withDefaults(
  defineProps<{
    sourceName: string
    consoleLabel?: string
    runButtonLabel?: string
    runButtonDisabled?: boolean
    showRunButton?: boolean
    isRunning?: boolean
    warningMessage?: string | null
    editorTitle?: string
    editorInitiallyVisible?: boolean
    editorInitialHeight?: number
    resultTableHeight?: string
    resultTables?: GenericQueryResultTable[]
    hasOutput?: boolean
    emptyStateMessage?: string
    logs?: SQLActivityEntry[]
    emptyLogMessage?: string
    logsInitiallyVisible?: boolean
  }>(),
  {
    consoleLabel: 'Console',
    runButtonLabel: 'Run query',
    runButtonDisabled: false,
    showRunButton: true,
    isRunning: false,
    warningMessage: null,
    editorTitle: 'Editor',
    editorInitiallyVisible: true,
    editorInitialHeight: 320,
    resultTableHeight: '20rem',
    resultTables: () => [],
    hasOutput: false,
    emptyStateMessage:
      'Run a query from the selected datasource to inspect one or more result sets here.',
    logs: () => [],
    emptyLogMessage: 'No query logs yet.',
    logsInitiallyVisible: true,
  },
)

const emit = defineEmits<{
  run: []
}>()

const slots = useSlots()
const editorVisible = ref(props.editorInitiallyVisible)
const logsVisible = ref(props.logsInitiallyVisible)
const editorHeight = ref(props.editorInitialHeight)

const emitRun = () => emit('run')

const toColumns = (columns: string[]): SQLTableColumn[] =>
  columns.map((column) => ({
    name: column,
    field: column,
  }))

const buildRows = (rows: Record<string, unknown>[], prefix: string | number): SQLTableRowDraft[] =>
  rows.map((row, index) => ({
    id: `${String(prefix)}-${index}`,
    values: row,
    original: row,
    state: 'clean' as const,
  }))
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="border-b app-border flex items-center justify-between px-3 py-2">
      <slot name="header-title">
        <div class="flex items-center gap-3">
          <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">{{ sourceName }}</span>
          <span class="text-xs uppercase tracking-[0.16em] opacity-40 mono">{{
            consoleLabel
          }}</span>
        </div>
      </slot>

      <slot name="header-actions" :run="emitRun">
        <Button
          v-if="showRunButton"
          :icon="`ti ti-player-play ${isRunning ? 'animate-pulse' : ''}`"
          :label="runButtonLabel"
          :loading="isRunning"
          :disabled="runButtonDisabled"
          size="small"
          @click="emitRun"
        />
      </slot>
    </div>

    <Message v-if="warningMessage" severity="warn" class="m-3 mb-0">
      {{ warningMessage }}
    </Message>

    <CollapsiblePanel
      v-model:expanded="editorVisible"
      :title="editorTitle"
      root-class="border-b app-border"
      body-class="overflow-hidden"
    >
      <template #title>
        <slot name="editor-title">
          <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">{{ editorTitle }}</span>
        </slot>
      </template>

      <template #meta>
        <slot name="editor-meta" />
      </template>

      <template #actions>
        <slot name="editor-actions" />
      </template>

      <template #default>
        <slot name="editor" :height="`${editorHeight}px`" />
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

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="!hasOutput" class="h-full flex flex-col">
        <CollapsibleActivityPanel
          v-if="logs.length"
          v-model:expanded="logsVisible"
          :entries="logs"
          :empty-message="emptyLogMessage"
          expanded-class="min-h-0 flex-1"
          panel-class="h-full"
        />
        <slot v-else name="empty">
          <div class="h-full flex flex-col items-center justify-center gap-3 opacity-50">
            <p class="opacity-60">
              {{ emptyStateMessage }}
            </p>
          </div>
        </slot>
      </div>

      <div v-else class="h-full flex flex-col gap-4">
        <div
          v-if="slots.output || resultTables.length"
          class="min-h-0 flex-1 overflow-auto flex flex-col"
        >
          <slot v-if="slots.output" name="output" :result-tables="resultTables" />

          <template v-else>
            <section
              v-for="(resultTable, index) in resultTables"
              :key="resultTable.id ?? index"
              class="overflow-hidden shrink-0"
            >
              <div class="px-3 py-2 border-b app-border flex items-center justify-between">
                <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">
                  {{ resultTable.title }}
                </span>
                <div class="flex items-center gap-2">
                  <span v-if="resultTable.kind" class="text-xs opacity-50 mono">
                    {{ resultTable.kind }}
                  </span>
                  <DataExportButton
                    :file-base-name="resultTable.exportFileBaseName"
                    :table-name="resultTable.exportTableName"
                    :columns="resultTable.columns"
                    :rows="resultTable.rows"
                  />
                </div>
              </div>

              <div
                class="overflow-hidden"
                :x-style="{ height: resultTable.height ?? resultTableHeight }"
              >
                <ExtendedDataTable
                  :columns="toColumns(resultTable.columns)"
                  :rows="buildRows(resultTable.rows, resultTable.id ?? index)"
                  :can-edit="false"
                />
              </div>
            </section>
          </template>
        </div>

        <CollapsibleActivityPanel
          v-if="logs.length"
          v-model:expanded="logsVisible"
          :entries="logs"
          :empty-message="emptyLogMessage"
          expanded-class="border-t app-border shrink-0"
          collapsed-class="border-t app-border px-3 py-2 flex items-center justify-between shrink-0"
          panel-class="h-[12rem]"
        />
      </div>
    </div>
  </div>
</template>
