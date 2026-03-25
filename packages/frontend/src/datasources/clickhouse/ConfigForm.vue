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
    engine="clickhouse"
    :redacted-secret-fields="redactedSecretFields"
    show-ssl
    optional-user
    optional-password
    optional-database
  />
</template>
