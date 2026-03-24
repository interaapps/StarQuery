<script setup lang="ts">
import SectionLabel from '@/components/common/SectionLabel.vue'

export type SQLActivityEntry = {
  id: string
  level: 'info' | 'success' | 'error'
  title?: string
  message: string
  sql?: string
  statement?: number
  durationMs?: number
}

defineProps<{
  entries: SQLActivityEntry[]
  emptyMessage?: string
  title?: string
  flat?: boolean
  hideHeader?: boolean
}>()

const levelLabel: Record<SQLActivityEntry['level'], string> = {
  info: 'INFO',
  success: 'OK',
  error: 'ERROR',
}

const levelClass: Record<SQLActivityEntry['level'], string> = {
  info: 'text-sky-300',
  success: 'text-emerald-300',
  error: 'text-red-300',
}
</script>

<template>
  <section
    class="overflow-hidden"
    :class="
      flat
        ? 'rounded-none border-0'
        : 'rounded-2xl border app-border'
    "
  >
    <div
      v-if="!hideHeader"
      class="px-3 py-2 border-b app-border flex items-center justify-between"
    >
      <SectionLabel :text="title || 'Logs'" class="opacity-60" />
      <div class="flex items-center gap-2">
        <span class="text-xs opacity-50 mono"
          >{{ entries.length }} entr{{ entries.length === 1 ? 'y' : 'ies' }}</span
        >
        <slot name="actions" />
      </div>
    </div>

    <div class="bg-neutral-950 text-neutral-100 mono text-xs h-full overflow-auto">
      <div v-if="entries.length" class="divide-y divide-white/6">
        <div v-for="entry in entries" :key="entry.id" class="px-3 py-2 flex items-start gap-3">
          <span v-if="entry.statement" class="opacity-40 shrink-0">#{{ entry.statement }}</span>
          <span :class="levelClass[entry.level]" class="shrink-0">{{
            levelLabel[entry.level]
          }}</span>
          <div class="min-w-0 flex-1">
            <div v-if="entry.title" class="opacity-80">{{ entry.title }}</div>
            <div class="opacity-95 break-words">{{ entry.message }}</div>
            <pre
              v-if="entry.sql"
              class="mt-2 overflow-auto rounded-md bg-black/25 px-3 py-2 text-xs leading-5 text-neutral-200 whitespace-pre-wrap break-words"
            ><code>{{ entry.sql }}</code></pre>
          </div>
          <span v-if="typeof entry.durationMs === 'number'" class="opacity-45 shrink-0">
            {{ entry.durationMs }} ms
          </span>
        </div>
      </div>

      <div v-else class="px-3 py-2 opacity-55">
        {{ emptyMessage || 'No log entries yet.' }}
      </div>
    </div>
  </section>
</template>
