<script lang="ts" setup>
import { computed, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { EditorState } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import type { SQLNamespace } from '@codemirror/lang-sql'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import {
  commonEditorExtensions,
  createEditorSubmitExtension,
  createSingleLineEnterExtension,
} from './editor-extensions.ts'
import { starQueryTheme } from './theme-starquery.ts'
import type { DataSourceType } from '@/types/sql'
import { getSqlEditorDialect } from '@/datasources/shared-sql/dialect'

const singleLineExtension = EditorView.domEventHandlers({
  beforeinput(event) {
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
  return getSqlEditorDialect(props.sourceType)
})

const view = shallowRef<EditorView>()
const handleReady = (payload: {
  view: EditorView
  container: HTMLDivElement
  state: EditorState
}) => {
  view.value = payload.view
}

const emit = defineEmits<{
  enter: []
  submit: []
}>()

const singleLineExtensions = computed(() => [
  singleLineExtension,
  preventNewline,
  createSingleLineEnterExtension(() => emit('enter')),
])

const extensions = computed(() => [
  sql({
    dialect: dialect.value,
    schema: props.schema,
    defaultTable: props.defaultTable,
    defaultSchema: props.defaultSchema,
  }),
  ...commonEditorExtensions,
  autocompletion(),
  createEditorSubmitExtension(() => emit('submit')),
  ...(props.multiline ? [] : singleLineExtensions.value),
  starQueryTheme,
])

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
  />
</template>
