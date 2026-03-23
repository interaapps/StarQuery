<script setup lang="ts">
import { useConnectionStore } from '@/stores/connections-store.ts'
import { SQLWebSocket } from '@/utils/connections/SQLWebSocket.ts'
import { computed, ref, shallowRef } from 'vue'
import { useAsyncState } from '@vueuse/core'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
import { client } from '@/main.ts'
import Button from 'primevue/button'
import { useTabsStore } from '@/stores/tabs-store.ts'

const props = defineProps<{
  source: any
}>()

const connectionStore = useConnectionStore()
const tabsStore = useTabsStore()

const tables = ref([])

const { execute: connectAndCollapse, isLoading } = useAsyncState(
  async () => {
    if (isConnected.value) return

    const connection = new SQLWebSocket(
      `ws://localhost:3000/api/projects/REPLME/sources/${props.source.name}/sql`,
    )

    await connection.connectIfNotConnected()

    tables.value = (
      await client.get(`/api/projects/REPLME/sources/${props.source.name}/tables`)
    ).data

    connectionStore.connections[props.source.name] = connection
  },
  undefined,
  { immediate: false },
)

console.log(connectionStore)
const isConnected = computed(() => !!connectionStore.connections[props.source.name])

const openTable = (name: string) => {
  tabsStore.openNewTab({
    name,
    type: 'database.sql.table',
    data: {
      connection: {
        socket: connectionStore.connections[props.source.name],
      },
      defaultQuery: `SELECT * FROM ${name} limit 100`,
    },
  })
}
</script>
<template>
  <div>
    <Button
      class="py-1 px-2 flex gap-2 items-center justify-between w-full rounded-md pr-1"
      text
      severity="secondary"
      @click="() => connectAndCollapse()"
      size="small"
    >
      <div class="flex gap-2 items-center">
        <LogoLoadingSpinner v-if="isLoading" width="1rem" />
        <i v-else class="ti ti-chevron-down" />

        <div class="relative">
          <i class="ti ti-brand-mysql" />
          <div
            class="w-[6px] h-[6px] rounded-xl right-0 bottom-[4px] absolute"
            :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
          />
          <div
            class="w-[6px] h-[6px] animate-[ping_5s_infinite] rounded-xl right-0 bottom-[4px] absolute"
            :class="isConnected ? 'bg-green-500/80' : 'bg-red-500/80'"
          />
        </div>
        <span>{{ source.name }}</span>
      </div>
    </Button>

    <div class="pl-6">
      <Button
        v-for="table of tables"
        class="py-1 px-2 flex gap-2 items-center w-full rounded-md pr-1 justify-start"
        text
        severity="secondary"
        size="small"
        @click="openTable(table.name)"
      >
        <i class="ti ti-table" />
        <span>
          {{ table.name }}
        </span>
      </Button>
    </div>
  </div>
</template>
