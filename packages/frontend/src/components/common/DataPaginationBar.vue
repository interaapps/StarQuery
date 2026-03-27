<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'

const props = withDefaults(
  defineProps<{
    page: number
    pageSize: number
    pageSizeOptions?: number[]
    canPrevious?: boolean
    canNext?: boolean
    disabled?: boolean
    totalPages?: number | null
    summary?: string | null
  }>(),
  {
    pageSizeOptions: () => [5, 10, 15, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 1000000],
    canPrevious: false,
    canNext: false,
    disabled: false,
    totalPages: null,
    summary: null,
  },
)

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

const pageLabel = computed(() =>
  props.totalPages && props.totalPages > 0
    ? `Page ${props.page} / ${props.totalPages}`
    : `Page ${props.page}`,
)
</script>

<template>
  <div
    class="flex items-center gap-1 bg-white dark:bg-neutral-900 border app-border py-0 px-0.5 rounded-xl h-fit"
  >
    <Button
      icon="ti ti-chevron-left"
      size="small"
      text
      severity="secondary"
      rounded
      :disabled="disabled || !canPrevious"
      @click="emit('update:page', page - 1)"
    />
    <Select
      :model-value="pageSize"
      :options="pageSizeOptions"
      size="small"
      class="border-0"
      :disabled="disabled"
      input-class="px-0 text-xs"
      @update:model-value="(value) => typeof value === 'number' && emit('update:pageSize', value)"
    />
    <span class="text-xs mono opacity-60">{{ pageLabel }}</span>
    <span v-if="summary" class="text-xs mono opacity-45">• {{ summary }}</span>
    <Button
      icon="ti ti-chevron-right"
      size="small"
      text
      severity="secondary"
      rounded
      :disabled="disabled || !canNext"
      @click="emit('update:page', page + 1)"
    />
  </div>
</template>
