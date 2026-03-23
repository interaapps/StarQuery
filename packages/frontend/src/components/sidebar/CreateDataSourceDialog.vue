<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { pickSqliteFile } from '@/services/desktop-config'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceType } from '@/types/sql'

const visible = defineModel<boolean>('visible', { required: true })
const workspaceStore = useWorkspaceStore()

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      type: DataSourceType
      config: Record<string, unknown>
    },
  ]
}>()

const name = ref('')
const type = ref<DataSourceType>('mysql')
const host = ref('127.0.0.1')
const port = ref('3306')
const user = ref('')
const password = ref('')
const database = ref('')
const filePath = ref('')
const availableTypes = computed<DataSourceType[]>(
  () => workspaceStore.serverInfo?.capabilities.dataSources ?? ['mysql', 'postgres'],
)
const typeOptions = computed(() =>
  availableTypes.value.map((value) => ({
    value,
    label:
      value === 'mysql' ? 'MySQL' : value === 'postgres' ? 'Postgres' : 'SQLite',
  })),
)

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    name.value = ''
    type.value = availableTypes.value.includes('mysql') ? 'mysql' : (availableTypes.value[0] ?? 'mysql')
    host.value = '127.0.0.1'
    port.value = '3306'
    user.value = ''
    password.value = ''
    database.value = ''
    filePath.value = ''
  },
)

watch(type, (nextType) => {
  port.value = nextType === 'postgres' ? '5432' : '3306'
})

watch(availableTypes, (nextTypes) => {
  if (!nextTypes.includes(type.value)) {
    type.value = nextTypes.includes('mysql') ? 'mysql' : (nextTypes[0] ?? 'mysql')
  }
})

const payload = computed(() => {
  if (type.value === 'sqlite') {
    return {
      name: name.value.trim(),
      type: type.value,
      config: {
        filePath: filePath.value.trim(),
      },
    }
  }

  return {
    name: name.value.trim(),
    type: type.value,
    config: {
      host: host.value.trim(),
      port: Number(port.value),
      user: user.value.trim(),
      password: password.value,
      database: database.value.trim(),
    },
  }
})

const canSubmit = computed(() => {
  if (!payload.value.name) return false

  if (payload.value.type === 'sqlite') {
    return Boolean(payload.value.config.filePath)
  }

  return Boolean(
    payload.value.config.host &&
      payload.value.config.port &&
      payload.value.config.user &&
      payload.value.config.database,
  )
})

const browseSqliteFile = async () => {
  const selectedFile = await pickSqliteFile()
  if (selectedFile) {
    filePath.value = selectedFile
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Add Datasource" :style="{ width: '36rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Datasource name</label>
        <InputText v-model="name" fluid placeholder="warehouse" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Type</label>
        <Select
          v-model="type"
          :options="typeOptions"
          option-label="label"
          option-value="value"
          fluid
        />
      </div>

      <template v-if="type !== 'sqlite'">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Host</label>
            <InputText v-model="host" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Port</label>
            <InputText v-model="port" fluid />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">User</label>
            <InputText v-model="user" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Password</label>
            <InputText v-model="password" type="password" fluid />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Database</label>
          <InputText v-model="database" fluid />
        </div>
      </template>

      <div v-else class="flex flex-col gap-2">
        <label class="text-sm opacity-70">SQLite file path</label>
        <div class="flex gap-2">
          <InputText v-model="filePath" fluid readonly placeholder="Choose a local SQLite file" />
          <Button
            label="Browse"
            icon="ti ti-folder-open"
            severity="secondary"
            @click="browseSqliteFile"
          />
        </div>
      </div>

      <div class="flex justify-end">
        <Button
          label="Create datasource"
          icon="ti ti-database-plus"
          :disabled="!canSubmit"
          @click="emit('submit', payload)"
        />
      </div>
    </div>
  </Dialog>
</template>
