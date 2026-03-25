<script setup lang="ts">
import { computed } from 'vue'
import { getDisplayText } from '@/components/table/extended-data-table-utils'
import type { SQLTableRowState } from '@/types/sql'

const props = defineProps<{
  value: unknown
  rowState: SQLTableRowState
  readOnly?: boolean
}>()

const isNullValue = computed(() => props.value === null || props.value === undefined)
const displayText = computed(() => getDisplayText(props.value))
</script>

<template>
  <div
    class="px-1.5 py-1 min-h-[1.5rem] max-w-full overflow-hidden whitespace-nowrap truncate"
    :class="{
      'text-primary-500/80': rowState === 'new',
      'text-amber-500/90': rowState === 'modified',
    }"
  >
    <span v-if="isNullValue" class="opacity-35">NULL</span>
    <span v-else class="inline-flex max-w-full items-center gap-1 overflow-hidden truncate align-top">
      <span class="truncate">{{ displayText }}</span>
    </span>
    <i v-if="readOnly" class="ti ti-lock text-[11px] opacity-30" />
  </div>
</template>
