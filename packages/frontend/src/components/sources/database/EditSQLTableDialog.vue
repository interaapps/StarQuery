<script setup lang="ts">
import TableSchemaDialog from '@/components/sources/database/TableSchemaDialog.vue'
import type { DataSourceRecord } from '@/types/workspace'

defineProps<{
  source: DataSourceRecord
  tableName: string | null
}>()

const visible = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{
  applied: [payload: { tableName: string }]
}>()
</script>

<template>
  <TableSchemaDialog
    v-model:visible="visible"
    :source="source"
    mode="edit"
    :table-name="tableName"
    @applied="emit('applied', $event)"
  />
</template>
