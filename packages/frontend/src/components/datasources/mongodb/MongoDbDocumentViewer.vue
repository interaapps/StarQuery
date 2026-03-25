<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import JsonEditor from '@/components/editors/JsonEditor.vue'

const documentJson = defineModel<string>({
  default: '{\n}',
})

const props = withDefaults(
  defineProps<{
    mode: 'new' | 'selected'
    selectedLabel?: string | null
    canWrite?: boolean
    canDelete?: boolean
    loading?: boolean
    errorMessage?: string | null
  }>(),
  {
    selectedLabel: null,
    canWrite: false,
    canDelete: false,
    loading: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  reset: []
  deleteDocument: []
}>()

const headerLabel = computed(() =>
  props.mode === 'new' ? 'New document' : props.selectedLabel || 'Selected document',
)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b app-border px-3 py-2 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Viewer</div>
        <div class="truncate text-sm">{{ headerLabel }}</div>
      </div>

      <div class="flex items-center gap-1">
        <Button
          icon="ti ti-restore"
          label="Reset"
          text
          severity="secondary"
          size="small"
          @click="emit('reset')"
        />
        <Button
          v-if="mode === 'selected'"
          icon="ti ti-trash"
          label="Delete"
          text
          severity="danger"
          size="small"
          :disabled="!canWrite || !canDelete || loading"
          @click="emit('deleteDocument')"
        />
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <Message v-if="!canWrite" severity="warn" class="m-3 mb-0">
        This account can browse MongoDB documents but cannot create, edit or delete them.
      </Message>
      <Message v-else-if="errorMessage" severity="error" class="m-3 mb-0">
        {{ errorMessage }}
      </Message>

      <JsonEditor
        v-model="documentJson"
        class="h-full"
        height="100%"
        min-height="100%"
        placeholder="{\n}"
      />
    </div>
  </div>
</template>
