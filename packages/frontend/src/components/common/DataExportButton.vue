<script setup lang="ts">
import { computed } from 'vue'
import SplitButton from 'primevue/splitbutton'
import { triggerDataExport, type DataExportFormat } from '@/services/data-export'

const props = withDefaults(
  defineProps<{
    fileBaseName: string
    columns: string[]
    rows: Record<string, unknown>[]
    tableName?: string
    disabled?: boolean
    smaller?: boolean
    severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'help' | 'danger'
    label?: string
  }>(),
  {
    label: 'Export',
    severity: 'secondary',
    smaller: true,
  },
)

const exportFormats = [
  { label: 'CSV', format: 'csv' },
  { label: 'JSON', format: 'json' },
  { label: 'SQL Inserts', format: 'sql' },
  { label: 'XML', format: 'xml' },
  { label: 'HTML Table', format: 'html' },
] as const

const canExport = computed(() => !props.disabled && props.columns.length > 0)

const exportItems = computed(() =>
  exportFormats.map((entry) => ({
    label: entry.label,
    command: () => exportAs(entry.format),
  })),
)

function exportAs(format: DataExportFormat) {
  if (!canExport.value) {
    return
  }

  triggerDataExport(format, {
    fileBaseName: props.fileBaseName,
    columns: props.columns,
    rows: props.rows,
    tableName: props.tableName,
  })
}
</script>

<template>
  <SplitButton
    :label="props.label"
    icon="ti ti-download"
    size="small"
    :severity="props.severity"
    outlined
    :pt="
      props.smaller
        ? {
            pcButton: {
              root: 'pl-2 pr-3 py-1 text-sm',
            },
            pcDropdown: {
              root: 'p-0',
              dropdownicon: 'size-1',
              menubuttonicon: 'size-1',
            },
          }
        : {}
    "
    :disabled="!canExport"
    :model="exportItems"
    @click="exportAs('csv')"
  />
</template>
