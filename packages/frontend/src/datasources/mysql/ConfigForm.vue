<script setup lang="ts">
import SqlConnectionConfigForm from '@/datasources/shared-sql/SqlConnectionConfigForm.vue'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<Record<string, unknown>>('config', { required: true })
</script>

<template>
  <SqlConnectionConfigForm v-model:config="config" engine="mysql" :redacted-secret-fields="redactedSecretFields" />
</template>
