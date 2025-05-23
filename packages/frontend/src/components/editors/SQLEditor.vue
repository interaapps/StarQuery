<script lang="ts" setup>
import { ref, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { EditorState } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import { sql, MariaSQL, MySQL } from '@codemirror/lang-sql'
import { starQueryTheme } from './theme-starquery.ts'
import { EditorView } from 'codemirror'

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
      tr.update({
        changes: { from: 0, to: tr.newDoc.length, insert: newText.replace(/\n/g, ' ') },
      }),
    ]
  }

  return tr
})

const code = defineModel()
const extensions = [
  sql({
    dialect: MariaSQL,
    schema: {
      pastefy: {
        pastefy_pastes: [{ label: 'id' }],
      },
    },
  }),
  autocompletion(),
  singleLineExtension,
  preventNewline,
  starQueryTheme,
]

const view = shallowRef()
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
</script>
<template>
  <codemirror
    v-model="code"
    placeholder=""
    :style="{ height: '24px', width: '1000px' }"
    :autofocus="false"
    :indent-with-tab="true"
    :tab-size="2"
    :extensions="extensions"
    @ready="handleReady"
    @keydown="keydownEvent"
  />
</template>
