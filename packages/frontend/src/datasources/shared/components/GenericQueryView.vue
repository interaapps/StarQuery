<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import CollapsiblePanel from '@/components/common/CollapsiblePanel.vue'
import DataExportButton from '@/components/common/DataExportButton.vue'
import DataPaginationBar from '@/components/common/DataPaginationBar.vue'
import TabStrip from '@/components/common/TabStrip.vue'
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

const selectedTableTab = ref(0)
const selectedTablePage = ref(1)
const selectedTablePageSize = ref(50)
const selectedResultTable = computed(
  () => props.resultTables[selectedTableTab.value] ?? props.resultTables[0] ?? null,
)
const resultTabItems = computed(() =>
  props.resultTables.map((resultTable, index) => ({
    id: resultTable.id ? String(resultTable.id) : `result-${index}`,
    label: resultTable.title,
    icon: null,
  })),
)
const selectedResultTableRows = computed(() => selectedResultTable.value?.rows ?? [])
const selectedResultTotalPages = computed(() =>
  Math.max(1, Math.ceil(selectedResultTableRows.value.length / selectedTablePageSize.value)),
)
const selectedResultPageRows = computed(() => {
  const start = (selectedTablePage.value - 1) * selectedTablePageSize.value
  return selectedResultTableRows.value.slice(start, start + selectedTablePageSize.value)
})
const selectedResultPaginationSummary = computed(() => {
  const totalRows = selectedResultTableRows.value.length
  return `${totalRows} row${totalRows === 1 ? '' : 's'}`
})
const canPreviousResultPage = computed(() => selectedTablePage.value > 1)
const canNextResultPage = computed(() => selectedTablePage.value < selectedResultTotalPages.value)

watch(
  () => props.resultTables.length,
  (nextLength) => {
    if (selectedTableTab.value >= nextLength) {
      selectedTableTab.value = Math.max(0, nextLength - 1)
    }
  },
)

watch(selectedResultTable, () => {
  selectedTablePage.value = 1
})

watch(selectedResultTotalPages, (nextTotalPages) => {
  if (selectedTablePage.value > nextTotalPages) {
    selectedTablePage.value = nextTotalPages
  }
})

function changeSelectedResultPage(value: number) {
  selectedTablePage.value = Math.min(Math.max(1, value), selectedResultTotalPages.value)
}

function changeSelectedResultPageSize(value: number) {
  selectedTablePageSize.value = value
  selectedTablePage.value = 1
}
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
      body-class="overflow-hidden relative"
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

      <div v-else class="h-full min-h-0 flex flex-col">
        <div v-if="slots.output || resultTables.length" class="min-h-0 flex-1 overflow-hidden">
          <div class="min-h-0 h-full flex flex-col">
            <div v-if="slots.output" class="px-3 py-3 pr-4">
              <slot name="output" :result-tables="resultTables" />
            </div>

            <template v-else-if="selectedResultTable">
              <div class="shrink-0 border-b app-border">
                <TabStrip
                  v-if="resultTabItems.length > 1"
                  v-model:current-tab="selectedTableTab"
                  :tabs="resultTabItems"
                  :show-close-buttons="false"
                  :context-menu-enabled="false"
                  :close-on-middle-click="false"
                  :draggable="false"
                />
              </div>

              <section
                :key="selectedResultTable.id ?? selectedTableTab"
                class="min-h-0 overflow-hidden flex flex-col"
              >
                <div class="px-3 py-2 border-b app-border flex items-center justify-between">
                  <span class="text-xs uppercase tracking-[0.16em] opacity-60 mono">
                    {{ selectedResultTable.title }}
                  </span>
                  <div class="flex items-center gap-2">
                    <span v-if="selectedResultTable.kind" class="text-xs opacity-50 mono">
                      {{ selectedResultTable.kind }}
                    </span>
                    <DataExportButton
                      :file-base-name="selectedResultTable.exportFileBaseName"
                      :table-name="selectedResultTable.exportTableName"
                      :columns="selectedResultTable.columns"
                      :rows="selectedResultTable.rows"
                    />
                  </div>
                </div>

                <div class="min-h-0 overflow-hidden relative">
                  <ExtendedDataTable
                    class="h-full pb-20"
                    :columns="toColumns(selectedResultTable.columns)"
                    :rows="
                      buildRows(selectedResultPageRows, selectedResultTable.id ?? selectedTableTab)
                    "
                    :can-edit="false"
                  />

                  <div class="absolute bottom-6 left-[50%] translate-x-[-50%]">
                    <DataPaginationBar
                      :page="selectedTablePage"
                      :page-size="selectedTablePageSize"
                      :total-pages="selectedResultTotalPages"
                      :summary="selectedResultPaginationSummary"
                      :can-previous="canPreviousResultPage"
                      :can-next="canNextResultPage"
                      @update:page="changeSelectedResultPage"
                      @update:page-size="changeSelectedResultPageSize"
                    />
                  </div>
                </div>
              </section>
            </template>
          </div>
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
