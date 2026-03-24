<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { pickSqliteFile } from '@/services/desktop-config'

const config = defineModel<{
  filePath?: string
}>('config', { required: true })

const browseSqliteFile = async () => {
  const selectedFile = await pickSqliteFile()
  if (selectedFile) {
    config.value.filePath = selectedFile
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">SQLite file path</label>
    <div class="flex gap-2">
      <InputText size="small" v-model="config.filePath" fluid readonly placeholder="Choose a local SQLite file" />
      <Button size="small" label="Browse" icon="ti ti-folder-open" severity="secondary" @click="browseSqliteFile" />
    </div>
  </div>
</template>
