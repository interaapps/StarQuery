<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { autocompletion } from '@codemirror/autocomplete'
import { json } from '@codemirror/lang-json'
import { EditorView } from '@codemirror/view'
import { Codemirror } from 'vue-codemirror'
import { commonEditorExtensions, createEditorSubmitExtension } from './editor-extensions.ts'
import { starQueryTheme } from './theme-starquery.ts'

const code = defineModel<string>({
  default: '',
})

const props = defineProps<{
  placeholder?: string
  height?: string
  minHeight?: string
  autofocus?: boolean
}>()

const emit = defineEmits<{
  submit: []
}>()

const extensions = computed(() => [
  json(),
  ...commonEditorExtensions,
  autocompletion(),
  EditorState.tabSize.of(2),
  EditorView.lineWrapping,
  starQueryTheme,
  createEditorSubmitExtension(() => emit('submit')),
])

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

const focusOnNextFrame = () => {
  requestAnimationFrame(() => {
    focusEditor()
  })
}

watch(
  () => props.autofocus,
  (nextValue) => {
    if (nextValue) {
      focusOnNextFrame()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (props.autofocus) {
    focusOnNextFrame()
  }
})

defineExpose({
  focusEditor,
})
</script>

<template>
  <Codemirror
    v-model="code"
    :placeholder="props.placeholder"
    :style="{ height: props.height || '14rem', minHeight: props.minHeight || '0', width: '100%' }"
    :autofocus="false"
    :indent-with-tab="true"
    :tab-size="2"
    :extensions="extensions"
    @ready="handleReady"
  />
</template>
