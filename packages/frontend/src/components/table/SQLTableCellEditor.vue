<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Textarea from 'primevue/textarea'
import type { SQLTableColumn } from '@/types/sql'

type EditorKind = 'text' | 'textarea' | 'enum' | 'date' | 'datetime' | 'time'

const props = defineProps<{
  modelValue: unknown
  column: SQLTableColumn
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  commit: []
  cancel: []
}>()

const textInput = ref<unknown>(null)
const enumMenu = ref()
const datePicker = ref()
const textValue = ref('')
const dateValue = ref<Date | null>(null)
const suppressBlurCommit = ref(false)

const normalizedType = computed(() => (props.column.type || '').toLowerCase())
const editorKind = computed<EditorKind>(() => {
  if (props.column.enumValues?.length) {
    return 'enum'
  }

  if (/\b(char|varchar|text|tinytext|mediumtext|longtext|json)\b/.test(normalizedType.value)) {
    return 'textarea'
  }

  if (/\b(timestamp|datetime)\b/.test(normalizedType.value)) {
    return 'datetime'
  }

  if (/\btime\b/.test(normalizedType.value) && !/\b(timestamp|datetime)\b/.test(normalizedType.value)) {
    return 'time'
  }

  if (/\bdate\b/.test(normalizedType.value)) {
    return 'date'
  }

  return 'text'
})

const enumMenuItems = computed(() => [
  ...(props.column.nullable !== false
    ? [
        {
          label: 'Set NULL',
          icon: 'ti ti-circle-off',
          command: () => onEnumChange(null),
        },
      ]
    : []),
  ...((props.column.enumValues ?? []).map((value) => ({
    label: value,
    command: () => onEnumChange(value),
  })) as Array<{ label: string; command: () => void }>),
])

const pad = (value: number) => String(value).padStart(2, '0')

const parseDateValue = (value: unknown, kind: EditorKind) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) {
    return null
  }

  if (kind === 'date') {
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0)
    }
  }

  if (kind === 'time') {
    const match = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (match) {
      const date = new Date()
      date.setHours(Number(match[1]), Number(match[2]), Number(match[3] ?? '0'), 0)
      return date
    }
  }

  const normalized = raw.replace(' ', 'T')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const syncEditorValue = () => {
  if (editorKind.value === 'text' || editorKind.value === 'textarea' || editorKind.value === 'enum') {
    textValue.value = props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)
    return
  }

  dateValue.value = parseDateValue(props.modelValue, editorKind.value)
}

const getInputElement = (): HTMLInputElement | HTMLTextAreaElement | null => {
  if (textInput.value instanceof HTMLInputElement) {
    return textInput.value
  }

  if (textInput.value instanceof HTMLTextAreaElement) {
    return textInput.value
  }

  const candidate = textInput.value as { $el?: HTMLElement } | null
  if (!candidate?.$el) {
    return null
  }

  return candidate.$el.querySelector('textarea, input') as HTMLInputElement | HTMLTextAreaElement | null
}

watch(
  () => [props.modelValue, props.column.type, props.column.enumValues],
  () => {
    syncEditorValue()
  },
  { immediate: true },
)

const focusEditor = async () => {
  await nextTick()

  if (editorKind.value === 'text' || editorKind.value === 'textarea') {
    const input = getInputElement()
    input?.focus()
    input?.select()
    return
  }

  if (editorKind.value === 'enum') {
    const input = getInputElement()
    input?.focus()
    input?.select()
    return
  }

  const dateInput = datePicker.value?.$el?.querySelector('input') as HTMLInputElement | null
  dateInput?.focus()
  dateInput?.select?.()
  datePicker.value?.show?.()
}

const emitTextUpdate = () => {
  emit('update:modelValue', textValue.value)
}

const emitDateUpdate = (value: Date | Date[] | (Date | null)[] | null | undefined) => {
  const normalizedValue = value instanceof Date ? value : null
  dateValue.value = normalizedValue
  emit('update:modelValue', normalizedValue)
}

const onEnumChange = (value: string | null) => {
  textValue.value = value ?? ''
  emit('update:modelValue', value)
  emit('commit')
}

const emitEnumUpdate = () => {
  emit('update:modelValue', textValue.value)
}

const onEnumInputBlur = () => {
  if (suppressBlurCommit.value) {
    suppressBlurCommit.value = false
    return
  }

  emit('commit')
}

const openEnumMenu = (event: MouseEvent) => {
  suppressBlurCommit.value = true
  event.preventDefault()
  event.stopPropagation()
  enumMenu.value?.toggle(event)
}

onMounted(() => {
  void focusEditor()
})

defineExpose({
  focusEditor,
})
</script>

<template>
  <input
    v-if="editorKind === 'text'"
    ref="textInput"
    v-model="textValue"
    class="w-full h-full border border-primary-500 bg-white dark:bg-neutral-950 p-1.5 px-2 outline-none"
    @input="emitTextUpdate"
    @blur="$emit('commit')"
    @keydown.enter.prevent="$emit('commit')"
    @keydown.esc.prevent="$emit('cancel')"
    @mousedown.stop
  />

  <Textarea
    v-else-if="editorKind === 'textarea'"
    ref="textInput"
    v-model="textValue"
    class="w-full border border-primary-500 bg-white dark:bg-neutral-950 rounded-none mono text-sm leading-5 max-h-[13.25rem] overflow-auto select-text"
    auto-resize
    rows="1"
    @input="emitTextUpdate"
    @blur="$emit('commit')"
    @keydown.enter.exact.stop
    @keydown.meta.enter.prevent="$emit('commit')"
    @keydown.ctrl.enter.prevent="$emit('commit')"
    @keydown.esc.prevent="$emit('cancel')"
    @mousedown.stop
    @mousemove.stop
    @mouseup.stop
    @click.stop
    @dblclick.stop
    @wheel.stop
  />

  <div
    v-else-if="editorKind === 'enum'"
    class="w-full h-full flex items-stretch bg-white dark:bg-neutral-950"
    @mousedown.stop
  >
    <InputText
      ref="textInput"
      v-model="textValue"
      class="w-full h-full rounded-none rounded-l-md border-primary-500"
      placeholder="Enum value"
      @input="emitEnumUpdate"
      @blur="onEnumInputBlur"
      @keydown.enter.prevent="$emit('commit')"
      @keydown.esc.prevent="$emit('cancel')"
    />
    <Button
      icon="ti ti-chevron-down"
      severity="secondary"
      class="h-full rounded-none rounded-r-md border border-l-0 border-primary-500"
      @mousedown.prevent.stop
      @click="openEnumMenu"
    />
    <Menu ref="enumMenu" popup :model="enumMenuItems" />
  </div>

  <DatePicker
    v-else
    ref="datePicker"
    :model-value="dateValue"
    class="w-full h-full"
    size="small"
    fluid
    show-icon
    icon-display="input"
    :manual-input="false"
    show-clear
    :show-time="editorKind === 'datetime'"
    :time-only="editorKind === 'time'"
    :hour-format="editorKind === 'time' || editorKind === 'datetime' ? '24' : undefined"
    :date-format="editorKind === 'date' ? 'yy-mm-dd' : 'yy-mm-dd'"
    :hide-on-date-time-select="editorKind === 'datetime' || editorKind === 'time'"
    @update:model-value="emitDateUpdate"
    @date-select="editorKind === 'date' ? $emit('commit') : undefined"
    @hide="$emit('commit')"
    @clear-click="$emit('commit')"
    @keydown.esc.prevent="$emit('cancel')"
    @mousedown.stop
  />
</template>
