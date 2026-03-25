import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useConnectionStore = defineStore('connections', () => {
  const connections = ref<Record<string, unknown>>({})

  return { connections }
})
