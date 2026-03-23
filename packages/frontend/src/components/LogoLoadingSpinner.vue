<script setup lang="ts">
defineProps<{
  width?: string
}>()
</script>
<template>
  <div class="relative select-none">
    <img
      src="@/assets/logo-part-outline.svg"
      class="animate-[spin_4s_linear_infinite]"
      :style="{ width: width || '3rem' }"
    />
    <img
      src="@/assets/logo-part-outline.svg"
      class="animate-[spin_2s_linear_reverse_infinite] absolute top-0 left-0"
      :style="{ width: width || '3rem' }"
    />
  </div>
</template>
