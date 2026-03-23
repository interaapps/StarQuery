import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

export const useConnectionStore = defineStore('connections', () => {
  const connections = ref<Record<string, any>>({})

  return { connections }
})
