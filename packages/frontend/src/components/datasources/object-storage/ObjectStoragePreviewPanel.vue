<script setup lang="ts">
import { computed, ref } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import { formatBytes } from '@/datasources/shared-object-storage/byte-format'
import type { DataSourceResourceListing } from '@/types/datasources'

const props = withDefaults(
  defineProps<{
    listing: DataSourceResourceListing | null
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const previewHeight = ref(300)

const previewJson = computed(() =>
  props.listing?.preview?.type === 'json' ? JSON.stringify(props.listing.preview.value, null, 2) : null,
)

const propertyRows = computed(() => {
  const details = props.listing?.details
  if (!details) {
    return []
  }

  const rows = [
    { key: 'Name', value: details.name },
    { key: 'Kind', value: details.kind },
    { key: 'Path', value: details.path },
    { key: 'Content type', value: details.contentType ?? '' },
    { key: 'Size', value: formatBytes(details.size) || '' },
    { key: 'Created', value: details.createdAt ?? '' },
    { key: 'Updated', value: details.updatedAt ?? '' },
    { key: 'ETag', value: details.etag ?? '' },
  ].filter((row) => row.value !== '' && row.value !== null)

  const metadataRows = Object.entries(details.metadata ?? {}).map(([key, value]) => ({
    key: `Metadata • ${key}`,
    value: key.toLowerCase().includes('size') ? formatBytes(value) || value : value,
  }))

  return [...rows, ...metadataRows]
})
</script>

<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <LogoLoadingSpinner width="2rem" />
    </div>

    <template v-else>
      <div class="border-b app-border px-4 py-3">
        <div v-if="listing?.details" class="flex flex-col gap-1">
          <div class="text-sm font-semibold">{{ listing.details.name }}</div>
          <div class="text-xs opacity-60 mono break-all">{{ listing.details.path }}</div>
        </div>
        <div v-else class="text-sm opacity-60">
          Select an object to inspect its preview and properties.
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden">
        <section :style="{ height: `${previewHeight}px` }" class="flex min-h-0 flex-col overflow-hidden">
          <div class="border-b app-border px-4 py-2">
            <div class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Preview</div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-4">
            <Message v-if="!listing?.preview" severity="secondary" :closable="false">
              No preview is available for the current selection.
            </Message>

            <template v-else-if="listing.preview.type === 'json'">
              <pre class="h-full text-xs bg-neutral-100 dark:bg-neutral-900 p-3 overflow-auto">{{ previewJson }}</pre>
            </template>

            <template v-else-if="listing.preview.type === 'text'">
              <pre class="h-full text-xs bg-neutral-100 dark:bg-neutral-900 p-3 overflow-auto whitespace-pre-wrap break-words">{{ listing.preview.text }}</pre>
            </template>

            <template v-else-if="listing.preview.type === 'table'">
              <DataTable :value="listing.preview.rows" size="small">
                <Column v-for="column of listing.preview.columns" :key="column" :field="column" :header="column" />
              </DataTable>
            </template>
          </div>
        </section>

        <ResizeKnob
          v-model:height="previewHeight"
          direction="vertical"
          :min-height="180"
          :max-height="560"
          class="border-y app-border"
        />

        <section class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div class="border-b app-border px-4 py-2">
            <div class="text-xs uppercase tracking-[0.16em] opacity-60 mono">Properties</div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-4">
            <Message v-if="!propertyRows.length" severity="secondary" :closable="false">
              No properties are available for the current selection.
            </Message>

            <DataTable v-else :value="propertyRows" size="small">
              <Column field="key" header="Property" style="width: 16rem" />
              <Column field="value" header="Value">
                <template #body="{ data }">
                  <span class="break-all">{{ data.value }}</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
