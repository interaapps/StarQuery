import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Using https://github.com/one-dark/vscode-one-dark-theme/ as reference for the colors

const chalky = '#e5c07b',
  coral = '#bd5c64',
  cyan = '#4399a3',
  invalid = '#ff7b72',
  ivory = '#abb2bf',
  stone = '#7d8799', // Brightened compared to original to increase contrast
  malibu = '#4f93ca',
  sage = '#61a134',
  whiskey = '#d19a66',
  violet = '#c678dd',
  darkBackground = 'rgba(15, 23, 42, 0.92)',
  highlightBackground = 'rgba(99, 102, 241, 0.18)',
  background = 'transparent',
  tooltipBackground = 'rgba(17, 24, 39, 0.98)',
  selection = '#D6347222',
  cursor = '#3a65bc'

/// The colors used in the theme, as CSS color strings.
export const color = {
  chalky,
  coral,
  cyan,
  invalid,
  ivory,
  stone,
  malibu,
  sage,
  whiskey,
  violet,
  darkBackground,
  highlightBackground,
  background,
  tooltipBackground,
  selection,
  cursor,
}

/// The editor theme styles for One Dark.
export const oneDarkTheme = EditorView.theme(
  {
    '&': {
      color: 'inherit',
      backgroundColor: background,
    },

    '.cm-content': {
      caretColor: cursor,
    },

    '.cm-cursor, .cm-dropCursor': { borderLeftColor: cursor },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: selection },

    '.cm-panels': { backgroundColor: darkBackground, color: ivory },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid rgba(148, 163, 184, 0.25)' },
    '.cm-panels.cm-panels-bottom': { borderTop: '1px solid rgba(148, 163, 184, 0.25)' },

    '.cm-searchMatch': {
      backgroundColor: '#72a1ff59',
      outline: '1px solid #457dff',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#6199ff2f',
    },

    '.cm-activeLine': { backgroundColor: '#6699ff0b' },
    '.cm-selectionMatch': { backgroundColor: '#aafe661a' },

    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#bad0f847',
    },

    '.cm-gutters': {
      backgroundColor: background,
      color: stone,
      border: 'none',
    },

    '.cm-activeLineGutter': { backgroundColor: 'rgba(99, 102, 241, 0.08)' },

    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#ddd',
    },

    '.cm-tooltip': {
      border: 'none',
      backgroundColor: tooltipBackground,
      color: ivory,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: tooltipBackground,
      borderBottomColor: tooltipBackground,
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: highlightBackground,
        color: ivory,
      },
    },
  },
  { dark: true },
)

/// The highlighting style for code in the One Dark theme.
export const oneDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: violet },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: coral },
  { tag: [t.function(t.variableName), t.labelName], color: malibu },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: whiskey },
  { tag: [t.definition(t.name), t.separator], color: ivory },
  {
    tag: [
      t.typeName,
      t.className,
      t.number,
      t.changed,
      t.annotation,
      t.modifier,
      t.self,
      t.namespace,
    ],
    color: chalky,
  },
  {
    tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
    color: cyan,
  },
  { tag: [t.meta, t.comment], color: stone },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: stone, textDecoration: 'underline' },
  { tag: t.heading, fontWeight: 'bold', color: coral },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: whiskey },
  { tag: [t.processingInstruction, t.string, t.inserted], color: sage },
  { tag: t.invalid, color: invalid },
])

/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export const starQueryTheme: Extension = [oneDarkTheme, syntaxHighlighting(oneDarkHighlightStyle)]
