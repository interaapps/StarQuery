<script setup lang="ts">
import Button from 'primevue/button'
import type { WorkspaceTab } from '@/types/tabs'

const currentTab = defineModel<number>('currentTab', { required: true })

const props = defineProps<{
  tabs: WorkspaceTab[]
}>()

const emit = defineEmits<{
  close: [index: number]
}>()

function getTabIcon(tab: WorkspaceTab) {
  return {
    'database.sql.query': 'file-type-sql',
    'database.sql.table': 'table',
    'datasource.resource.browser': 'folders',
  }[tab.type]
}
</script>

<template>
  <div v-if="props.tabs.length" class="border-b border-neutral-200 dark:border-neutral-800 flex">
    <Button
      v-for="(tab, index) of props.tabs"
      :key="tab.id ?? `${tab.type}:${index}`"
      size="small"
      class="rounded-none border-y-0 border-l-0 border-r border-neutral-200 dark:border-neutral-800"
      :severity="currentTab === index ? 'primary' : 'secondary'"
      text
      @click="currentTab = index"
    >
      <i :class="`ti ti-${getTabIcon(tab)}`" />
      <span>{{ tab.name }}</span>
      <span v-if="tab.dirty" class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
      <Button
        rounded
        icon="ti ti-x"
        :class="`p-0 w-[1rem] h-[1rem] hover:bg-primary-500/30 ${currentTab === index ? '' : 'opacity-0'} hover:opacity-100`"
        text
        @click.stop="emit('close', index)"
      />
    </Button>
    <div class="w-max h-full region-drag" />
  </div>
</template>
