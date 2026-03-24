import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { WorkspaceTab } from '@/types/tabs'

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<WorkspaceTab[]>([])

  const currentTab = ref(0)

  const openNewTab = (data: WorkspaceTab) => {
    if (data.id) {
      const existingIndex = tabs.value.findIndex((tab) => tab.id === data.id)
      if (existingIndex !== -1) {
        tabs.value[existingIndex] = { ...tabs.value[existingIndex], ...data }
        currentTab.value = existingIndex
        return
      }
    }

    currentTab.value = tabs.value.push(data) - 1
  }

  const closeTab = (index: number) => {
    tabs.value.splice(index, 1)
    if (!tabs.value.length) {
      currentTab.value = 0
      return
    }

    currentTab.value = Math.max(0, Math.min(currentTab.value, tabs.value.length - 1))
  }

  const updateTab = (index: number, patch: Partial<WorkspaceTab>) => {
    if (!tabs.value[index]) return
    tabs.value[index] = {
      ...tabs.value[index],
      ...patch,
    }
  }

  const closeTabsMatching = (predicate: (tab: WorkspaceTab) => boolean) => {
    tabs.value = tabs.value.filter((tab) => !predicate(tab))
    if (!tabs.value.length) {
      currentTab.value = 0
      return
    }

    currentTab.value = Math.min(currentTab.value, tabs.value.length - 1)
  }

  return { tabs, currentTab, openNewTab, closeTab, updateTab, closeTabsMatching }
})
