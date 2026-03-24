<script setup lang="ts">
import Button from 'primevue/button'

const props = withDefaults(
  defineProps<{
    icon: string
    label: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  click: []
  contextmenu: [event: MouseEvent]
}>()
</script>

<template>
  <Button
    class="flex w-full items-center justify-start text-sm rounded-md px-2 py-1 pr-1 truncate"
    :icon
    :label
    text
    severity="secondary"
    size="small"
    :disabled="props.disabled"
    @click="emit('click')"
    @contextmenu.prevent="emit('contextmenu', $event)"
  />
</template>
