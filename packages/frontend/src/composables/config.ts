import { useStorage } from '@vueuse/core'
import type { SelectedTheme } from '@/utils/theme-logic.ts'
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function useConfig() {
  return useStorage<{
    apiKey?: string
    sideBarShown?: boolean
    theme?: SelectedTheme
    animations?: boolean
  }>(
    'star-config',
    // Default values:
    {
      apiKey: undefined,
      sideBarShown: window.innerWidth > 1024,
      theme: 'system',
      animations: !prefersReducedMotion.matches,
    },
    localStorage,
    {
      mergeDefaults: true,
    },
  )
}
