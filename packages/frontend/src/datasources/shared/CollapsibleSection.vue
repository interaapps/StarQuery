<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    summary?: string
    defaultExpanded?: boolean
  }>(),
  {
    description: '',
    summary: '',
    defaultExpanded: false,
  },
)

const expanded = ref(props.defaultExpanded)

watch(
  () => props.defaultExpanded,
  (nextExpanded) => {
    if (nextExpanded) {
      expanded.value = true
    }
  },
)
</script>

<template>
  <div class="rounded-xl border app-border overflow-hidden">
    <button
      type="button"
      class="w-full px-3 py-3 flex items-start justify-between gap-3 text-left cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex flex-col gap-1 min-w-0">
        <div class="text-sm font-medium">{{ title }}</div>
        <div v-if="description" class="text-xs opacity-65">{{ description }}</div>
        <div v-if="summary" class="text-xs opacity-55">{{ summary }}</div>
      </div>
      <i
        :class="expanded ? 'ti ti-chevron-up' : 'ti ti-chevron-down'"
        class="text-sm opacity-60 pt-0.5"
      />
    </button>

    <div v-if="expanded" class="px-3 pb-3 flex flex-col gap-3">
      <slot />
    </div>
  </div>
</template>
