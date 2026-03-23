<script setup lang="ts">
import SqlTableView from '@/views/SQLTableView.vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useTabsStore } from '@/stores/tabs-store.ts'
import SQLColumnEditor from '@/components/sources/database/SQLColumnEditor.vue'

const tabsStore = useTabsStore()
</script>

<template>
  <Dialog header="Edit Column" modal class="w-[50rem] min-h-[30rem]">
    <SQLColumnEditor />
  </Dialog>
  <div class="flex flex-col w-full h-full">
    <div
      class="border-b border-neutral-200 dark:border-neutral-800 flex"
      v-if="tabsStore.tabs.length"
    >
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
            }[tab.type as string]
          }`"
        />
        <span>{{ tab.name }}</span>
        <Button
          rounded
          icon="ti ti-x"
          :class="`p-0 w-[1rem] h-[1rem] hover:bg-primary-500/30 ${tabsStore.currentTab === index ? '' : 'opacity-0'} hover:opacity-100`"
          text
          @click="tabsStore.closeTab(index)"
        />
      </Button>
      <div class="w-max h-full region-drag" />
    </div>

    <div
      v-if="!tabsStore.tabs.length"
      class="w-full h-full flex items-center justify-center region-drag"
    >
      <div class="flex flex-col items-center">
        <div class="relative animate-[spin_60s_linear_infinite] select-none opacity-20">
          <img
            src="@/assets/logo-part-outline.svg"
            class="w-[4rem] relative"
            style="animation: first-star 10s; transform: rotate(106deg)"
          />
          <img
            src="@/assets/logo-part-outline.svg"
            class="w-[4rem] absolute top-0"
            style="animation: second-star 10s"
          />
        </div>
      </div>
    </div>

    <template v-for="(tab, index) of tabsStore.tabs">
      <div v-show="index === tabsStore.currentTab" class="h-full">
        <SqlTableView class="h-full" v-if="tab.type === 'database.sql.table'" :data="tab.data" />
        <div class="flex items-center justify-center w-full h-full" v-else>
          <span class="opacity-60"> There is no view for this type yet. </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
@keyframes first-star {
  0% {
    transform: rotate(0deg);
    opacity: 0;
  }

  30% {
    opacity: 1;
    transform: rotate(calc(360deg * 4));
  }
  100% {
    transform: rotate(calc(360deg * 4));
  }
}

@keyframes second-star {
  0% {
    opacity: 0;
    transform: rotate(0deg);
  }

  30% {
    opacity: 1;
  }

  50% {
    transform: rotate(calc(360deg * 7 + 106deg));
  }
  100% {
    transform: rotate(calc(360deg * 7 + 106deg));
  }
}
</style>
