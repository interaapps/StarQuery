<script lang="ts" setup>
import { computed, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { EditorState } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import type { SQLNamespace } from '@codemirror/lang-sql'
import { MariaSQL, PostgreSQL, SQLite, sql } from '@codemirror/lang-sql'
import { starQueryTheme } from './theme-starquery.ts'
import { EditorView } from 'codemirror'
import type { DataSourceType } from '@/types/sql'

const singleLineExtension = EditorView.domEventHandlers({
  beforeinput(event, view) {
    if (event.inputType === 'insertLineBreak') {
      event.preventDefault()
      return true
    }
    return false
  },
})

const preventNewline = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr

  const newText = tr.newDoc.toString()
  if (newText.includes('\n')) {
    return [
      tr.startState.update({
        changes: { from: 0, to: tr.newDoc.length, insert: newText.replace(/\n/g, ' ') },
      }),
    ]
  }

  return tr
})

const code = defineModel<string>({
  default: '',
})
const props = defineProps<{
  placeholder?: string
  multiline?: boolean
  height?: string
  sourceType?: DataSourceType
  schema?: SQLNamespace
  defaultTable?: string
  defaultSchema?: string
}>()

const dialect = computed(() => {
  switch (props.sourceType) {
    case 'postgres':
      return PostgreSQL
    case 'sqlite':
      return SQLite
    default:
      return MariaSQL
  }
})

const extensions = computed(() => [
  sql({
    dialect: dialect.value,
    schema: props.schema,
    defaultTable: props.defaultTable,
    defaultSchema: props.defaultSchema,
  }),
  autocompletion(),
  ...(props.multiline ? [] : [singleLineExtension, preventNewline]),
  starQueryTheme,
])

const view = shallowRef<EditorView>()
const handleReady = (payload: {
  view: EditorView
  container: HTMLDivElement
  state: EditorState
}) => {
  view.value = payload.view
}

const emit = defineEmits(['enter'])

const keydownEvent = (e: KeyboardEvent) => {
  if (e.code === 'Enter') {
    emit('enter')
  }
}

const focusEditor = () => {
  view.value?.focus()
}

defineExpose({
  focusEditor,
})
</script>
<template>
  <codemirror
    v-model="code"
    :placeholder="placeholder"
    :style="{ height: props.height || (props.multiline ? '14rem' : '24px'), width: '100%' }"
    :autofocus="false"
    :indent-with-tab="true"
    :tab-size="2"
    :extensions="extensions"
    @ready="handleReady"
    @keydown="keydownEvent"
  />
</template>
