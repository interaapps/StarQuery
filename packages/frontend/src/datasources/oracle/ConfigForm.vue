<script setup lang="ts">
import SqlConnectionConfigForm from '@/datasources/shared-sql/SqlConnectionConfigForm.vue'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<Record<string, unknown>>('config', { required: true })
</script>

<template>
  <SqlConnectionConfigForm
    v-model:config="config"
    engine="oracle"
    :redacted-secret-fields="redactedSecretFields"
    database-label="Service name"
    database-placeholder="XEPDB1"
  />
</template>
