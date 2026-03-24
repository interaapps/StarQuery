<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import SectionLabel from '@/components/common/SectionLabel.vue'
import type { DataSourceResourceItem } from '@/types/datasources'

defineProps<{
  items: DataSourceResourceItem[]
  loading?: boolean
}>()

const selectedIndex = defineModel<string>('selectedIndex', {
  required: true,
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
      <SectionLabel text="Indices" class="opacity-60" />
      <span class="text-xs opacity-50 mono">{{ items.length }}</span>
    </div>

    <div v-if="!items.length && !loading" class="px-3 py-3 text-sm opacity-60">
      No indices available on this datasource.
    </div>

    <div v-else class="flex-1 min-h-0 overflow-auto p-2 flex flex-col gap-1">
      <Button size="small"
        v-for="item in items"
        :key="item.id"
        text
        severity="secondary"
        class="w-full justify-start rounded-xl px-3 py-2"
        :class="selectedIndex === item.name ? 'bg-primary-500/12 text-primary-500' : ''"
        @click="selectedIndex = item.name"
      >
        <div class="flex min-w-0 flex-1 items-start gap-2 text-left">
          <i class="ti ti-search shrink-0 mt-0.5 opacity-55" />
          <div class="min-w-0 flex-1">
            <div class="truncate">{{ item.name }}</div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-65">
              <Tag v-if="item.metadata?.health" :value="String(item.metadata.health)" severity="secondary" />
              <span v-if="item.metadata?.docs !== undefined">{{ item.metadata.docs }} docs</span>
              <span v-if="item.metadata?.size">{{ item.metadata.size }}</span>
            </div>
          </div>
        </div>
      </Button>
    </div>
  </div>
</template>
