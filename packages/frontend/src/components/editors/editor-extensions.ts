import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { EditorView, keymap } from '@codemirror/view'

export const commonEditorExtensions = [
  history(),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
]

function isMacPlatform() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const browserNavigator = navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }

  const platform =
    browserNavigator.userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent

  return /mac/i.test(platform)
}

export function createEditorSubmitExtension(onSubmit: () => void) {
  const runSubmit = () => {
    onSubmit()
    return true
  }

  return [
    keymap.of([
      {
        key: 'Mod-Enter',
        run: runSubmit,
      },
      {
        key: 'Cmd-Enter',
        run: runSubmit,
      },
    ]),
    EditorView.domEventHandlers({
      keydown(event) {
        const isSubmitShortcut = isMacPlatform()
          ? event.metaKey && !event.ctrlKey && (event.key === 'Enter' || event.code === 'NumpadEnter')
          : event.ctrlKey && !event.metaKey && (event.key === 'Enter' || event.code === 'NumpadEnter')

        if (!isSubmitShortcut) {
          return false
        }

        event.preventDefault()
        onSubmit()
        return true
      },
    }),
  ]
}

export function createSingleLineEnterExtension(onEnter: () => void) {
  return keymap.of([
    {
      key: 'Enter',
      run: () => {
        onEnter()
        return true
      },
    },
  ])
}
