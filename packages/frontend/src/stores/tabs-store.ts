import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { SQLWebSocket } from '@/utils/connections/SQLWebSocket.ts'

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<any[]>([])

  const currentTab = ref(0)

  const openNewTab = (data: any) => {
    currentTab.value = tabs.value.push(data) - 1
  }

  const closeTab = (index: number) => {
    tabs.value.splice(index, 1)
    currentTab.value = 0
  }

  return { tabs, currentTab, openNewTab, closeTab }
})
