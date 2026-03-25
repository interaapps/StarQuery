<script setup lang="ts">
import InputText from 'primevue/inputtext'

const config = defineModel<{
  filePath?: string
}>('config', { required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">DuckDB file path</label>
    <InputText size="small" v-model="config.filePath" fluid placeholder="/data/analytics.duckdb" />
  </div>
</template>
