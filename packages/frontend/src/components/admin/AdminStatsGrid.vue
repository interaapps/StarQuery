<script setup lang="ts">
defineProps<{
  usersCount: number
  rolesCount: number
  apiKeysCount: number
}>()

const cards = [
  { label: 'Users', key: 'usersCount' },
  { label: 'Roles', key: 'rolesCount' },
  { label: 'API keys', key: 'apiKeysCount' },
] as const
</script>

<template>
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div
      v-for="card in cards"
      :key="card.key"
      class="rounded-2xl border app-border px-4 py-3"
    >
      <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono">{{ card.label }}</div>
      <div class="text-3xl font-semibold mt-2">{{ $props[card.key] }}</div>
    </div>
  </div>
</template>
