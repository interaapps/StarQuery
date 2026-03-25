<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import Message from 'primevue/message'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import {
  buildMongoDbResultTable,
  buildMongoDocumentFromRow,
  createMongoDraftRow,
} from '@/datasources/mongodb/browser'
import type { MongoDbQueryResult } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = withDefaults(
  defineProps<{
    result: MongoDbQueryResult | null
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const columns = defineModel<SQLTableColumn[]>('columns', {
  default: [],
})
const rows = defineModel<SQLTableRowDraft[]>('rows', {
  default: [],
})
const focusedRowIndex = defineModel<number | null>('focusedRowIndex', {
  default: null,
})

const extendedDataTable = useTemplateRef<typeof ExtendedDataTable>('extendedDataTable')
const lastLoadedResult = ref<MongoDbQueryResult | null>(null)

function hydrateFromResult(result: MongoDbQueryResult | null) {
  if (!result) {
    columns.value = []
    rows.value = []
    focusedRowIndex.value = null
    lastLoadedResult.value = null
    return
  }

  const table = buildMongoDbResultTable(result)
  columns.value = table.columns
  rows.value = table.rows
  focusedRowIndex.value = table.rows.length ? 0 : null
  lastLoadedResult.value = result
}

watch(
  () => props.result,
  (nextResult) => {
    hydrateFromResult(nextResult)
  },
  { immediate: true },
)

defineExpose({
  addRow: () => {
    const row = createMongoDraftRow(columns.value)
    rows.value.push(row)
    const nextIndex = rows.value.length - 1
    focusedRowIndex.value = nextIndex
    requestAnimationFrame(() => {
      extendedDataTable.value?.focusRow?.(nextIndex)
    })
    return nextIndex
  },
  duplicateSelectedRows: () => {
    const selectedRows =
      (extendedDataTable.value?.getSelectedRowIndexes?.() ?? [])
        .map((index: number) => rows.value[index])
        .filter((row: SQLTableRowDraft | undefined): row is SQLTableRowDraft => !!row && row.state !== 'deleted')

    if (!selectedRows.length) {
      return null
    }

    const duplicates = selectedRows.map((row: SQLTableRowDraft) => {
      const document = buildMongoDocumentFromRow(row, columns.value) ?? {}
      delete document._id
      return createMongoDraftRow(columns.value, document)
    })

    rows.value.push(...duplicates)
    const nextIndex = rows.value.length - duplicates.length
    focusedRowIndex.value = nextIndex
    requestAnimationFrame(() => {
      extendedDataTable.value?.focusRow?.(nextIndex)
    })
    return nextIndex
  },
  deleteSelectedRows: () => extendedDataTable.value?.deleteSelectedRows?.(),
  getSelectedRows: () => {
    const indexes = extendedDataTable.value?.getSelectedRowIndexes?.() ?? []
    return indexes
      .map((index: number) => rows.value[index])
      .filter((row: SQLTableRowDraft | undefined): row is SQLTableRowDraft => !!row)
  },
  getFocusedRow: () =>
    typeof focusedRowIndex.value === 'number' ? rows.value[focusedRowIndex.value] ?? null : null,
  focusRow: (rowIndex: number, columnIndex = 0) => {
    extendedDataTable.value?.focusRow?.(rowIndex, columnIndex)
  },
  resetFromResult: () => hydrateFromResult(lastLoadedResult.value),
})
</script>

<template>
  <div class="relative h-full">
    <Message v-if="!loading && !result" severity="secondary" :closable="false">
      Run a query to inspect documents from this collection.
    </Message>
    <div v-else-if="!loading && !rows.length" class="flex items-center justify-center h-full">
      <p class="opacity-50">No documents matched this query.</p>
    </div>
    <ExtendedDataTable
      v-else
      ref="extendedDataTable"
      v-model:columns="columns"
      v-model:rows="rows"
      v-model:focused-row-index="focusedRowIndex"
      :can-edit="true"
      class="h-full"
    />

    <div
      v-if="loading"
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/65 backdrop-blur-[1px] dark:bg-neutral-950/65"
    >
      <LogoLoadingSpinner width="2rem" />
    </div>
  </div>
</template>
