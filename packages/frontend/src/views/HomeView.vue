<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import WorkspaceTabsBar from '@/components/workspace/WorkspaceTabsBar.vue'
import ElasticsearchBrowserView from '@/datasources/elasticsearch/views/ElasticsearchBrowserView.vue'
import ObjectStorageBrowserView from '@/datasources/shared-object-storage/views/ObjectStorageBrowserView.vue'
import DataSourceBrowserView from '@/datasources/shared-resource/views/DataSourceBrowserView.vue'
import SQLQueryView from '@/datasources/shared-sql/views/SQLQueryView.vue'
import SqlTableView from '@/datasources/shared-sql/views/SQLTableView.vue'
import { isElectronDesktop } from '@/services/desktop-config'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { isResourceBrowserTab, isSqlQueryTab, isSqlTableTab } from '@/types/tabs'
import Button from 'primevue/button'

const tabsStore = useTabsStore()

function handleWindowKeydown(event: KeyboardEvent) {
  if (!isElectronDesktop() || !tabsStore.tabs.length) {
    return
  }

  const isCloseShortcut =
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === 'w'

  if (!isCloseShortcut) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  tabsStore.closeCurrentTab()
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown, true)
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <WorkspaceTabsBar
      v-model:current-tab="tabsStore.currentTab"
      :tabs="tabsStore.tabs"
      @close="tabsStore.closeTab"
      @close-others="tabsStore.closeOtherTabs"
      @close-tabs-to-right="tabsStore.closeTabsToRight"
    />

    <div v-if="!tabsStore.tabs.length" class="w-full h-full flex items-center justify-center">
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

    <Button size="small" icon="ti ti-home" text rounded class="opacity-0" />

    <template v-for="(tab, index) of tabsStore.tabs">
      <div v-show="index === tabsStore.currentTab" class="h-full">
        <SqlTableView class="h-full" v-if="isSqlTableTab(tab)" :tab-id="tab.id" :data="tab.data" />
        <SQLQueryView class="h-full" v-else-if="isSqlQueryTab(tab)" :data="tab.data" />
        <ElasticsearchBrowserView
          class="h-full"
          v-else-if="isResourceBrowserTab(tab) && tab.data.sourceType === 'elasticsearch'"
          :data="tab.data"
        />
        <ObjectStorageBrowserView
          class="h-full"
          v-else-if="
            isResourceBrowserTab(tab) &&
            (tab.data.sourceType === 's3' || tab.data.sourceType === 'minio')
          "
          :data="tab.data"
        />
        <DataSourceBrowserView
          class="h-full"
          v-else-if="isResourceBrowserTab(tab)"
          :data="tab.data"
        />
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
