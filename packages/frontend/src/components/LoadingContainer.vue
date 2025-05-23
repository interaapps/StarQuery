<script setup lang="ts">
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'
defineProps<{
  showText?: boolean
}>()
</script>
<template>
  <div class="flex items-center justify-center h-full w-full flex-col">
    <LogoLoadingSpinner />
    <span v-if="showText" class="text-sm animate-bounce mt-2 opacity-60">loading</span>
  </div>
</template>
