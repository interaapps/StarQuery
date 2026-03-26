<script setup lang="ts">
import { computed, ref, useSlots, useTemplateRef } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import DataExportButton from '@/components/common/DataExportButton.vue'
import DataPaginationBar from '@/components/common/DataPaginationBar.vue'
import LoadingContainer from '@/components/LoadingContainer.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import CollapsibleActivityPanel from '@/components/sql/CollapsibleActivityPanel.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = withDefaults(
  defineProps<{
    canLoadRows?: boolean
    canEdit?: boolean
    isLoading?: boolean
    isSaving?: boolean
    fileBaseName: string
    tableName?: string
    exportColumns?: string[]
    exportRows?: Record<string, unknown>[]
    exportDisabled?: boolean
    page?: number
    pageSize?: number
    totalPages?: number | null
    paginationSummary?: string | null
    paginationDisabled?: boolean
    canPreviousPage?: boolean
    canNextPage?: boolean
    showPagination?: boolean
    activityLogs?: SQLActivityEntry[]
    emptyLogMessage?: string
    readWarningMessage?: string | null
    statusMessage?: string | null
    logsInitiallyVisible?: boolean
    logsInitialHeight?: number
    showRefreshButton?: boolean
    showSaveButton?: boolean
    showDiscardButton?: boolean
    showAddRowButton?: boolean
    showDeleteRowsButton?: boolean
    showActivityPanel?: boolean
    showFooter?: boolean
  }>(),
  {
    canLoadRows: true,
    canEdit: true,
    isLoading: false,
    isSaving: false,
    exportColumns: undefined,
    exportRows: undefined,
    exportDisabled: false,
    page: 1,
    pageSize: 50,
    totalPages: null,
    paginationSummary: null,
    paginationDisabled: false,
    canPreviousPage: false,
    canNextPage: false,
    showPagination: true,
    activityLogs: () => [],
    emptyLogMessage: 'No table logs yet.',
    readWarningMessage: null,
    statusMessage: null,
    logsInitiallyVisible: true,
    logsInitialHeight: 160,
    showRefreshButton: true,
    showSaveButton: true,
    showDiscardButton: true,
    showAddRowButton: true,
    showDeleteRowsButton: true,
    showActivityPanel: true,
    showFooter: true,
  },
)

const emit = defineEmits<{
  refresh: []
  save: []
  discard: []
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'add-row': [focusedRowIndex: number | null]
  'delete-rows': []
}>()

const slots = useSlots()
const columns = defineModel<SQLTableColumn[]>('columns', { default: () => [] })
const rows = defineModel<SQLTableRowDraft[]>('rows', { default: () => [] })
const focusedRowIndex = defineModel<number | null>('focusedRowIndex', { default: null })

const extendedDataTable = useTemplateRef<typeof ExtendedDataTable>('extendedDataTable')
const logsVisible = ref(props.logsInitiallyVisible)
const logsHeight = ref(props.logsInitialHeight)

const dirtyRows = computed(() => rows.value.filter((row) => row.state !== 'clean'))
const hasPendingChanges = computed(() => dirtyRows.value.length > 0)
const dirtyCounts = computed(() => ({
  inserted: dirtyRows.value.filter((row) => row.state === 'new').length,
  updated: dirtyRows.value.filter((row) => row.state === 'modified').length,
  deleted: dirtyRows.value.filter((row) => row.state === 'deleted').length,
}))
const resolvedExportColumns = computed(
  () => props.exportColumns ?? columns.value.map((column) => column.field),
)
const resolvedExportRows = computed(
  () =>
    props.exportRows ??
    rows.value.filter((row) => row.state !== 'deleted').map((row) => ({ ...row.values })),
)
const exportDisabled = computed(() => props.exportDisabled || !props.canLoadRows)

const addRow = () => {
  extendedDataTable.value?.addRow()
  emit('add-row', extendedDataTable.value?.getFocusedRowIndex?.() ?? focusedRowIndex.value)
}

const duplicateSelectedRows = () => extendedDataTable.value?.duplicateSelectedRows()

const deleteSelectedRows = () => {
  extendedDataTable.value?.deleteSelectedRows()
  emit('delete-rows')
}

defineExpose({
  addRow,
  duplicateSelectedRows,
  deleteSelectedRows,
  focusGrid: () => extendedDataTable.value?.focusGrid?.(),
  focusRow: (rowIndex: number, columnIndex = 0) =>
    extendedDataTable.value?.focusRow?.(rowIndex, columnIndex),
  getFocusedRowIndex: () =>
    extendedDataTable.value?.getFocusedRowIndex?.() ?? focusedRowIndex.value,
  getSelectedRowIndexes: () => extendedDataTable.value?.getSelectedRowIndexes?.() ?? [],
  hasPendingChanges: () => hasPendingChanges.value,
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <div class="border-b app-border flex h-[2.5rem] items-center px-1 justify-between gap-3">
      <div class="flex items-center gap-0.5">
        <slot name="toolbar-actions-prefix" />

        <Button
          v-if="showRefreshButton"
          size="small"
          :icon="`ti ti-refresh ${isLoading ? 'animate-spin' : ''}`"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canLoadRows"
          @click="emit('refresh')"
        />
        <Button
          v-if="showSaveButton"
          size="small"
          icon="ti ti-device-floppy"
          class="size-[1.8rem]"
          rounded
          text
          :severity="hasPendingChanges ? 'primary' : 'contrast'"
          :disabled="!canEdit || !hasPendingChanges || isSaving"
          aria-label="Save changes"
          @click="emit('save')"
        />
        <Button
          v-if="showDiscardButton"
          size="small"
          icon="ti ti-reload"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canLoadRows || !hasPendingChanges"
          aria-label="Discard"
          @click="emit('discard')"
        />
        <Button
          v-if="showAddRowButton"
          size="small"
          icon="ti ti-plus"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canEdit"
          @click="addRow"
        />
        <Button
          v-if="showDeleteRowsButton"
          size="small"
          icon="ti ti-trash"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canEdit"
          @click="deleteSelectedRows"
        />

        <slot name="toolbar-actions-suffix" />
      </div>

      <div class="flex items-center gap-4">
        <slot name="toolbar-end">
          <DataExportButton
            :file-base-name="fileBaseName"
            :table-name="tableName"
            :columns="resolvedExportColumns"
            :rows="resolvedExportRows"
            :disabled="exportDisabled"
          />
        </slot>
      </div>
    </div>

    <div
      v-if="slots.filters"
      class="border-b app-border flex flex-wrap px-3 py-0 items-center gap-3"
    >
      <slot name="filters" />
    </div>

    <Message v-if="readWarningMessage" severity="warn" class="m-3 mb-0">
      {{ readWarningMessage }}
    </Message>

    <div v-if="isLoading" class="border-b h-full app-border">
      <LoadingContainer />
    </div>

    <div v-else class="border-b app-border overflow-hidden h-full min-h-0">
      <div class="h-full min-h-0 flex flex-col">
        <div class="min-h-0 flex-1 overflow-hidden relative">
          <slot name="table-before" />

          <ExtendedDataTable
            ref="extendedDataTable"
            v-model:columns="columns"
            v-model:rows="rows"
            v-model:focused-row-index="focusedRowIndex"
            :can-edit="canEdit"
            :class="showPagination ? 'pb-20' : undefined"
          />

          <div v-if="showPagination" class="absolute bottom-6 left-[50%] translate-x-[-50%]">
            <DataPaginationBar
              :page="page"
              :page-size="pageSize"
              :total-pages="totalPages"
              :summary="paginationSummary"
              :disabled="paginationDisabled"
              :can-previous="canPreviousPage"
              :can-next="canNextPage"
              @update:page="emit('update:page', $event)"
              @update:page-size="emit('update:pageSize', $event)"
            />
          </div>
        </div>

        <ResizeKnob
          v-if="showActivityPanel && activityLogs.length && logsVisible"
          v-model:height="logsHeight"
          direction="vertical"
          :min-height="96"
          :max-height="280"
          class="border-t app-border"
        />

        <CollapsibleActivityPanel
          v-if="showActivityPanel"
          v-model:expanded="logsVisible"
          :entries="activityLogs"
          :empty-message="emptyLogMessage"
          expanded-class="border-t app-border"
          panel-class="h-full"
          :expanded-style="{ height: `${logsHeight}px` }"
        />
      </div>
    </div>

    <div
      v-if="showFooter"
      class="border-t app-border px-3 py-2 flex items-center justify-between text-xs mono opacity-60"
    >
      <span>
        {{ dirtyCounts.inserted }} inserted / {{ dirtyCounts.updated }} updated /
        {{ dirtyCounts.deleted }} deleted
      </span>
      <span v-if="hasPendingChanges">Unsaved changes on current page</span>
      <span v-else-if="statusMessage">{{ statusMessage }}</span>
      <span v-else>Everything saved</span>
    </div>
  </div>
</template>
