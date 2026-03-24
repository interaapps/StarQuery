<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { EditorState } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { Codemirror } from 'vue-codemirror'
import { starQueryTheme } from './theme-starquery.ts'

const code = defineModel<string>({
  default: '',
})

const props = defineProps<{
  placeholder?: string
  height?: string
}>()

const emit = defineEmits<{
  submit: []
}>()

const submitShortcut = EditorView.domEventHandlers({
  keydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      emit('submit')
      return true
    }

    return false
  },
})

const extensions = computed(() => [json(), autocompletion(), EditorState.tabSize.of(2), starQueryTheme, submitShortcut])

const view = shallowRef<EditorView>()

const handleReady = (payload: {
  view: EditorView
  container: HTMLDivElement
  state: EditorState
}) => {
  view.value = payload.view
}

const focusEditor = () => {
  view.value?.focus()
}

defineExpose({
  focusEditor,
})
</script>

<template>
  <Codemirror
    v-model="code"
    :placeholder="placeholder"
    :style="{ height: height || '14rem', width: '100%' }"
    :autofocus="false"
    :indent-with-tab="true"
    :tab-size="2"
    :extensions="extensions"
    @ready="handleReady"
  />
</template>
