<script lang="ts" setup>
import { useAsyncState } from '@vueuse/core'
import { client } from '@/main.ts'
import Button from 'primevue/button'
import Tree from 'primevue/tree'
import ResizeKnob from '@/components/ResizeKnob.vue'
import SidebarSQLSource from '@/components/sidebar/SidebarSQLSource.vue'

const sidebarWidth = defineModel<number>('sidebarWidth')

const { state: sources, isLoading } = useAsyncState(async () => {
  return (await client.get('/api/projects/test/sources')).data
}, [])
</script>
<template>
  <div class="border-r border-neutral-200 dark:border-neutral-800 px-0.5 relative">
    <div class="flex w-full justify-between items-center p-2 pb-0 pt-0.5 pr-0 region-drag">
      <span class="opacity-60">sources</span>
      <Button
        icon="ti ti-plus text-lg p-0.5"
        size="small"
        rounded
        severity="contrast"
        text
        class="region-no-drag"
      />
    </div>

    <div>
      <template v-for="source of sources">
        <SidebarSQLSource :source="source" />
      </template>
    </div>

    <ResizeKnob
      :min-width="230"
      :max-width="460"
      v-model:width="sidebarWidth"
      class="absolute right-[-0.3rem] top-0"
    />
  </div>
</template>
