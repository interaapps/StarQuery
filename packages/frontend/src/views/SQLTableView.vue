<script setup lang="ts">
import Button from 'primevue/button'
import LoadingContainer from '@/components/LoadingContainer.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import { onMounted, ref, useTemplateRef } from 'vue'
import { SQLWebSocket } from '@/utils/connections/SQLWebSocket.ts'

const extendedDataTable = useTemplateRef<typeof ExtendedDataTable>('extendedDataTable')

const props = defineProps<{
  data: {
    connection: {
      socket: SQLWebSocket
    }
    defaultQuery: string
  }
}>()

const isLoading = ref(true)

const query = ref(props.data.defaultQuery)

const columns = ref([])
const data = ref([])

const runQuery = async () => {
  isLoading.value = true
  const ws = props.data.connection.socket
  await ws.connectIfNotConnected()

  const res = await ws.sendWithResponse({
    type: 'query',
    query: query.value,
  })

  columns.value = res.fields.map((c) => ({ name: c.name, field: c.name }))
  data.value = res.rows

  console.log(res)

  await new Promise((r) => setTimeout(r, 200))
  isLoading.value = false
}

onMounted(async () => {
  runQuery()
})
</script>

<template>
  <div class="flex flex-col w-full h-full justify-between">
    <div class="flex flex-col h-full w-full">
      <div
        class="border-b border-neutral-200 dark:border-neutral-800 flex h-[2rem] items-center p-1 justify-between"
      >
        <div class="flex items-center">
          <Button
            :icon="`ti ti-refresh ${isLoading ? 'animate-spin' : ''}`"
            class="h-[1.6rem] w-[1.6rem]"
            rounded
            text
            severity="contrast"
            @click="runQuery"
          />
          <Button
            icon="ti ti-clock"
            class="h-[1.6rem] w-[1.6rem]"
            rounded
            text
            severity="contrast"
          />
          <Button
            @click="() => extendedDataTable!.addRow()"
            v-shortkey="['ctrl', 'alt', 'o']"
            @shortkey="() => extendedDataTable!.addRow()"
            icon="ti ti-plus"
            class="h-[1.6rem] w-[1.6rem]"
            rounded
            text
            severity="contrast"
          />
          <Button
            @click="() => extendedDataTable!.deleteSelectedRows()"
            v-shortkey="['backspace']"
            @shortkey="() => extendedDataTable!.deleteSelectedRows()"
            icon="ti ti-minus"
            class="h-[1.6rem] w-[1.6rem]"
            rounded
            text
            severity="contrast"
          />
        </div>

        <div class="flex items-center">
          <Button
            icon="ti ti-download"
            class="h-[1.6rem] w-[1.6rem]"
            rounded
            text
            severity="contrast"
          />
        </div>
      </div>
      <div
        class="border-b border-neutral-200 dark:border-neutral-800 flex px-2 h-[2rem] items-center"
      >
        <div class="w-[25rem] mono text-sm">
          <SQLEditor v-model="query" class="w-full" @enter="runQuery" />
        </div>
      </div>
      <div v-if="isLoading" class="border-b h-full border-neutral-200 dark:border-neutral-800">
        <LoadingContainer />
      </div>
      <div v-else class="border-b border-neutral-200 dark:border-neutral-800 overflow-auto h-full">
        <ExtendedDataTable v-model:columns="columns" v-model:data="data" ref="extendedDataTable" />
      </div>
    </div>
  </div>
</template>
