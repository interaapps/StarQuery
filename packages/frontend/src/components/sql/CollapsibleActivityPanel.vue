<script setup lang="ts">
import type { StyleValue } from 'vue'
import Button from 'primevue/button'
import SectionLabel from '@/components/common/SectionLabel.vue'
import SQLActivityPanel, { type SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'

const expanded = defineModel<boolean>('expanded', { required: true })

withDefaults(
  defineProps<{
    entries: SQLActivityEntry[]
    emptyMessage?: string
    title?: string
    expandedClass?: string
    collapsedClass?: string
    panelClass?: string
    expandedStyle?: StyleValue
  }>(),
  {
    emptyMessage: 'No log entries yet.',
    title: 'Logs',
    expandedClass: '',
    collapsedClass: 'border-t app-border px-3 py-2 flex items-center justify-between',
    panelClass: '',
    expandedStyle: undefined,
  },
)
</script>

<template>
  <div v-if="entries.length">
    <div v-if="expanded" :class="expandedClass" :style="expandedStyle">
      <SQLActivityPanel
        :entries="entries"
        :empty-message="emptyMessage"
        :title="title"
        flat
        :class="panelClass"
      >
        <template #actions>
          <Button
            icon="ti ti-minus"
            size="small"
            text
            severity="secondary"
            @click="expanded = false"
          />
        </template>
      </SQLActivityPanel>
    </div>

    <div v-else :class="collapsedClass">
      <SectionLabel :text="title" class="opacity-60" />
      <Button
        icon="ti ti-plus"
        size="small"
        text
        severity="secondary"
        @click="expanded = true"
      />
    </div>
  </div>
</template>
