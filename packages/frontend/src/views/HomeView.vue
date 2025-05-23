<script setup lang="ts">
import SqlTableView from '@/views/SQLTableView.vue'
import Button from 'primevue/button'
import { useTabsStore } from '@/stores/tabs-store.ts'

const tabsStore = useTabsStore()
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="border-b border-neutral-200 dark:border-neutral-800 flex">
      <Button
        v-for="(tab, index) of tabsStore.tabs"
        size="small"
        class="rounded-none border-y-0 border-l-0 border-r border-neutral-200 dark:border-neutral-800"
        :severity="tabsStore.currentTab === index ? 'primary' : 'secondary'"
        text
        @click="tabsStore.currentTab = index"
      >
        <i
          :class="`ti ti-${
            {
              'database/sql/mysql:query': 'file-type-sql',
              'database/sql/mysql:table': 'table',
            }[tab.type]
          }`"
        />
        <span>{{ tab.name }}</span>
        <Button
          rounded
          icon="ti ti-x"
          :class="`p-0 w-[1rem] h-[1rem] hover:bg-primary-500/30 ${tabsStore.currentTab === index ? '' : 'opacity-0'} hover:opacity-100`"
          text
        />
      </Button>
      <div class="w-max h-full region-drag" />
    </div>

    <template v-for="(tab, index) of tabsStore.tabs">
      <div v-show="index === tabsStore.currentTab" class="h-full">
        <SqlTableView v-if="tab.type === 'database/sql/mysql:table'" :data="tab.data" />
        <div class="flex items-center justify-center w-full h-full" v-else>
          <span class="opacity-60"> There is no view for this type yet. </span>
        </div>
      </div>
    </template>
  </div>
</template>
