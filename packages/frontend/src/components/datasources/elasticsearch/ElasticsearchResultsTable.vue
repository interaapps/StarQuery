<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import Message from 'primevue/message'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import { buildElasticsearchResultTable } from '@/services/elasticsearch-browser'
import type { ElasticsearchSearchResult } from '@/types/datasources'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'

const props = withDefaults(
  defineProps<{
    result: ElasticsearchSearchResult | null
    canEdit?: boolean
    loading?: boolean
  }>(),
  {
    canEdit: false,
    loading: false,
  },
)

const columns = defineModel<SQLTableColumn[]>('columns', {
  default: [],
})
const rows = defineModel<SQLTableRowDraft[]>('rows', {
  default: [],
})

const extendedDataTable = useTemplateRef<typeof ExtendedDataTable>('extendedDataTable')
const lastLoadedResult = ref<ElasticsearchSearchResult | null>(null)

function hydrateFromResult(result: ElasticsearchSearchResult | null) {
  if (!result) {
    columns.value = []
    rows.value = []
    lastLoadedResult.value = null
    return
  }

  const table = buildElasticsearchResultTable(result)
  columns.value = table.columns
  rows.value = table.rows
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
  addRow: () => extendedDataTable.value?.addRow(),
  duplicateSelectedRows: () => extendedDataTable.value?.duplicateSelectedRows(),
  deleteSelectedRows: () => extendedDataTable.value?.deleteSelectedRows(),
  resetFromResult: () => hydrateFromResult(lastLoadedResult.value),
})
</script>

<template>
  <div class="relative h-full">
    <Message v-if="!loading && !result" severity="secondary" :closable="false">
      Run a search to inspect documents from this index.
    </Message>
    <Message v-else-if="!loading && !rows.length" severity="secondary" :closable="false">
      No documents matched this query.
    </Message>
    <ExtendedDataTable
      v-else
      ref="extendedDataTable"
      v-model:columns="columns"
      v-model:rows="rows"
      :can-edit="canEdit"
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
