<script setup lang="ts">
import S3CompatibleConfigForm from '@/datasources/shared-object-storage/S3CompatibleConfigForm.vue'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<Record<string, unknown>>('config', { required: true })
</script>

<template>
  <S3CompatibleConfigForm
    v-model:config="config"
    provider-label="S3-compatible storage"
    :redacted-secret-fields="redactedSecretFields"
  />
</template>
