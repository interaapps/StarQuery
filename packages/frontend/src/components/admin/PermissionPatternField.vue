<script setup lang="ts">
import { ref, watch } from 'vue'
import Textarea from 'primevue/textarea'
import type { PermissionTemplate } from '@/types/admin'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    helpers?: PermissionTemplate[]
    placeholder?: string
    rows?: number
  }>(),
  {
    helpers: () => [],
    placeholder: 'project.view.project-id',
    rows: 7,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const text = ref('')

function parsePermissions(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  )
}

function syncFromModel(value: string[]) {
  const nextText = value.join('\n')
  if (text.value !== nextText) {
    text.value = nextText
  }
}

function emitValue(value: string) {
  const nextPermissions = parsePermissions(value)
  if (JSON.stringify(nextPermissions) !== JSON.stringify(props.modelValue)) {
    emit('update:modelValue', nextPermissions)
  }
}

function addHelperPermission(permission: string) {
  const nextPermissions = Array.from(new Set([...props.modelValue, permission]))
  syncFromModel(nextPermissions)
  emit('update:modelValue', nextPermissions)
}

watch(
  () => props.modelValue,
  (value) => {
    syncFromModel(value)
  },
  { immediate: true, deep: true },
)

watch(text, (value) => {
  emitValue(value)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <Textarea size="small"
      v-model="text"
      auto-resize
      fluid
      :rows="rows"
      :placeholder="placeholder"
      class="mono text-sm"
    />

    <div v-if="helpers.length" class="flex flex-wrap gap-2">
      <button
        v-for="helper of helpers"
        :key="helper.label + helper.value"
        type="button"
        class="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-500/5 px-2 py-1 text-left text-xs transition-colors hover:bg-neutral-500/10"
        @click="addHelperPermission(helper.value)"
      >
        <span class="font-medium">{{ helper.label }}</span>
        <span class="mono opacity-70 ml-2">{{ helper.value }}</span>
      </button>
    </div>

    <p class="text-xs opacity-60">
      One permission pattern per line. Use dot-separated names and <span class="mono">*</span> as a wildcard.
    </p>
  </div>
</template>
