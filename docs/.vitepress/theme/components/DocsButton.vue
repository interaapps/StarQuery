<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    href?: string
    large?: boolean
    variant?: 'primary' | 'secondary'
    target?: string
    rel?: string
    ariaBusy?: boolean
  }>(),
  {
    href: '#',
    large: false,
    variant: 'primary',
    target: undefined,
    rel: undefined,
    ariaBusy: false,
  },
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center whitespace-nowrap rounded-full !no-underline transition-all active:scale-95'
  const size = props.large ? 'px-8 py-3 !text-xl font-bold tracking-[-0.02em]' : 'px-4 py-[0.3rem] text-[0.92rem] font-bold tracking-[-0.01em]'

  if (props.variant === 'secondary') {
    return [
      base,
      size,
      'border border-[var(--vp-c-border)] bg-[var(--vp-c-bg)] text-[var(--vp-c-default-1)] hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-200',
    ]
  }

  return [
    base,
    size,
    'border border-transparent bg-primary-500 !text-white hover:scale-110 hover:bg-primary-600',
  ]
})
</script>

<template>
  <a
    :href="href"
    :class="classes"
    :target="target"
    :rel="rel"
    :aria-busy="ariaBusy ? 'true' : 'false'"
  >
    <slot />
  </a>
</template>
