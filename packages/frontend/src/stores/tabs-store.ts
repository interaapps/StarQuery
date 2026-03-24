import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { WorkspaceTab } from '@/types/tabs'

function generateUniqueId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<WorkspaceTab[]>([])

  const currentTab = ref(0)

  const createTransientTabId = (prefix = 'tab') => `${prefix}:${generateUniqueId()}`

  const applyTabsState = (nextTabs: WorkspaceTab[], nextCurrentIndex = currentTab.value) => {
    tabs.value = nextTabs

    if (!nextTabs.length) {
      currentTab.value = 0
      return
    }

    currentTab.value = Math.max(0, Math.min(nextCurrentIndex, nextTabs.length - 1))
  }

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
    if (!tabs.value[index]) {
      return
    }

    const nextTabs = tabs.value.filter((_tab, tabIndex) => tabIndex !== index)
    let nextCurrentIndex = currentTab.value

    if (index < currentTab.value) {
      nextCurrentIndex -= 1
    } else if (index === currentTab.value) {
      nextCurrentIndex = index
    }

    applyTabsState(nextTabs, nextCurrentIndex)
  }

  const closeCurrentTab = () => {
    closeTab(currentTab.value)
  }

  const updateTab = (index: number, patch: Partial<WorkspaceTab>) => {
    if (!tabs.value[index]) return
    tabs.value[index] = {
      ...tabs.value[index],
      ...patch,
    }
  }

  const closeTabsMatching = (predicate: (tab: WorkspaceTab) => boolean) => {
    const remainingTabs = tabs.value.filter((tab) => !predicate(tab))
    if (remainingTabs.length === tabs.value.length) {
      return
    }

    const currentTabRecord = tabs.value[currentTab.value]
    const nextCurrentIndex = currentTabRecord
      ? remainingTabs.findIndex((tab) => tab.id === currentTabRecord.id)
      : -1

    applyTabsState(remainingTabs, nextCurrentIndex === -1 ? currentTab.value : nextCurrentIndex)
  }

  const closeOtherTabs = (index: number) => {
    const tab = tabs.value[index]
    if (!tab) {
      return
    }

    applyTabsState([tab], 0)
  }

  const closeTabsToRight = (index: number) => {
    if (!tabs.value[index]) {
      return
    }

    applyTabsState(tabs.value.slice(0, index + 1), Math.min(currentTab.value, index))
  }

  return {
    tabs,
    currentTab,
    createTransientTabId,
    openNewTab,
    closeTab,
    closeCurrentTab,
    closeOtherTabs,
    closeTabsToRight,
    updateTab,
    closeTabsMatching,
  }
})
