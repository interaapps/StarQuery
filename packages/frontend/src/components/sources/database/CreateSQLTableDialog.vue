<script setup lang="ts">
import TableSchemaDialog from '@/components/sources/database/TableSchemaDialog.vue'
import type { DataSourceRecord } from '@/types/workspace'

defineProps<{
  source: DataSourceRecord
}>()

const visible = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{
  applied: [payload: { tableName: string }]
}>()
</script>

<template>
  <TableSchemaDialog v-model:visible="visible" :source="source" mode="create" @applied="emit('applied', $event)" />
</template>
