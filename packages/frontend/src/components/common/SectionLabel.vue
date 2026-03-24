<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
  }>(),
  {
    text: '',
  },
)
</script>

<template>
  <span class="mono text-xs uppercase tracking-[0.16em]">
    <slot>{{ text }}</slot>
  </span>
</template>
