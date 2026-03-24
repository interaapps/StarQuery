<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import { formatBytes } from '@/datasources/shared-object-storage/byte-format'
import type { DataSourceResourceItem } from '@/types/datasources'

const props = withDefaults(
  defineProps<{
    items: DataSourceResourceItem[]
    loading?: boolean
    loadingMore?: boolean
    hasMore?: boolean
    selectedPath?: string
    canWrite?: boolean
  }>(),
  {
    loading: false,
    loadingMore: false,
    hasMore: false,
    canWrite: false,
  },
)

const selection = defineModel<DataSourceResourceItem[]>('selection', {
  default: [],
})

const emit = defineEmits<{
  open: [item: DataSourceResourceItem]
  preview: [item: DataSourceResourceItem]
  'delete-items': [items: DataSourceResourceItem[]]
  'load-more': []
}>()

const tableRoot = useTemplateRef<HTMLDivElement>('tableRoot')
let scrollContainer: HTMLElement | null = null

const isCheckboxEvent = (event: Event) =>
  event.target instanceof Element && Boolean(event.target.closest('.p-checkbox'))

const handleRowClick = (event: { data: DataSourceResourceItem; originalEvent: Event }) => {
  if (isCheckboxEvent(event.originalEvent)) {
    return
  }

  emit('preview', event.data)
}

const handleRowDoubleClick = (event: { data: DataSourceResourceItem; originalEvent: Event }) => {
  if (isCheckboxEvent(event.originalEvent)) {
    return
  }

  emit('open', event.data)
}

const onScroll = () => {
  if (!scrollContainer || props.loading || props.loadingMore || !props.hasMore) {
    return
  }

  const threshold = 120
  const remaining = scrollContainer.scrollHeight - (scrollContainer.scrollTop + scrollContainer.clientHeight)
  if (remaining <= threshold) {
    emit('load-more')
  }
}

const attachScrollListener = async () => {
  await nextTick()

  const nextContainer = tableRoot.value?.querySelector('.p-datatable-table-container') as HTMLElement | null
  if (scrollContainer === nextContainer) {
    return
  }

  scrollContainer?.removeEventListener('scroll', onScroll)
  scrollContainer = nextContainer
  scrollContainer?.addEventListener('scroll', onScroll, { passive: true })
}

watch(
  () => props.items.length,
  () => {
    void attachScrollListener()
  },
)

onMounted(() => {
  void attachScrollListener()
})

onBeforeUnmount(() => {
  scrollContainer?.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div ref="tableRoot" class="relative h-full">
    <DataTable
      v-model:selection="selection"
      :value="items"
    data-key="id"
    scrollable
    scroll-height="flex"
      size="small"
      class="h-full"
      :meta-key-selection="false"
      @row-click="handleRowClick"
      @row-dblclick="handleRowDoubleClick"
    >
      <Column selection-mode="multiple" header-style="width: 3rem" />
      <Column header="" style="width: 3rem">
        <template #body="{ data }">
          <i :class="`ti ${data.kind === 'container' ? 'ti-folder' : 'ti-file'}`" />
        </template>
      </Column>
      <Column field="name" header="Name">
        <template #body="{ data }">
          <button
            class="text-left hover:text-primary-500 w-full truncate"
            :class="selectedPath === data.path ? 'text-primary-500' : ''"
            @click.stop="emit('preview', data)"
            @dblclick.stop="emit('open', data)"
          >
            {{ data.name }}
          </button>
        </template>
      </Column>
      <Column header="Size" style="width: 8rem">
        <template #body="{ data }">
          {{ formatBytes(data.metadata?.size) }}
        </template>
      </Column>
      <Column header="Updated" style="width: 12rem">
        <template #body="{ data }">
          <span class="truncate block">
            {{ data.metadata?.updatedAt ?? data.metadata?.createdAt ?? '' }}
          </span>
        </template>
      </Column>
      <Column header="Type" style="width: 7rem">
        <template #body="{ data }">
          <Tag :value="data.kind" severity="secondary" />
        </template>
      </Column>
      <Column header="" style="width: 8rem">
        <template #body="{ data }">
          <div class="flex items-center justify-end gap-1">
            <Button
              v-if="data.kind === 'container'"
              icon="ti ti-folder-open"
              text
              rounded
              severity="secondary"
              size="small"
              @click.stop="emit('open', data)"
            />
            <Button
              v-else
              icon="ti ti-eye"
              text
              rounded
              severity="secondary"
              size="small"
              @click.stop="emit('preview', data)"
            />
            <Button
              v-if="canWrite"
              icon="ti ti-trash"
              text
              rounded
              severity="danger"
              size="small"
              @click.stop="emit('delete-items', [data])"
            />
          </div>
        </template>
      </Column>

      <template #empty>
        <div v-if="loading" class="flex min-h-[10rem] items-center justify-center">
          <LogoLoadingSpinner width="2rem" />
        </div>
        <div v-else class="py-6 text-center opacity-60">
          No objects found.
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-center gap-2 py-1 text-xs opacity-60">
          <LogoLoadingSpinner v-if="loadingMore" width="1rem" />
          <span v-if="loadingMore">Loading more objects…</span>
          <span v-else-if="hasMore">Scroll to load more</span>
          <span v-else-if="items.length">End of list</span>
        </div>
      </template>
    </DataTable>

    <div
      v-if="loading && items.length"
      class="absolute inset-0 z-10 flex items-center justify-center bg-white/65 backdrop-blur-[1px] dark:bg-neutral-950/65"
    >
      <LogoLoadingSpinner width="2rem" />
    </div>
  </div>
</template>
