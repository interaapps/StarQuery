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
    engine="cassandra"
    :redacted-secret-fields="redactedSecretFields"
    database-label="Keyspace"
    optional-user
    optional-password
    optional-database
    show-ssl
  />
</template>
