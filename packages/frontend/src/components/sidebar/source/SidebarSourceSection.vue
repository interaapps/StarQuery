<script setup lang="ts">
import Button from 'primevue/button'
import LogoLoadingSpinner from '@/components/LogoLoadingSpinner.vue'

const expanded = defineModel<boolean>('expanded', { required: true })

const props = withDefaults(
  defineProps<{
    loading?: boolean
    sourceIcon: string
    name: string
    actionIcon: string
    actionDisabled?: boolean
  }>(),
  {
    loading: false,
    actionDisabled: false,
  },
)

const emit = defineEmits<{
  toggle: []
  action: []
  sourceContextmenu: [event: MouseEvent]
}>()
</script>

<template>
  <div
    class="rounded-xl border border-transparent transition-colors hover:border-neutral-200 dark:hover:border-neutral-800"
  >
    <div class="flex items-center justify-between gap-2 px-1 py-1">
      <Button
        class="flex flex-1 items-center justify-between gap-2 rounded-md px-2 py-1 pr-1"
        text
        severity="secondary"
        size="small"
        @click="emit('toggle')"
        @contextmenu.prevent="emit('sourceContextmenu', $event)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <LogoLoadingSpinner v-if="props.loading" width="1rem" />
          <i v-else :class="`ti ${expanded ? 'ti-chevron-down' : 'ti-chevron-right'}`" />
          <i :class="`ti ti-${props.sourceIcon}`" />
          <span class="truncate">{{ props.name }}</span>
        </div>
      </Button>

      <Button
        :icon="props.actionIcon"
        size="small"
        rounded
        text
        severity="secondary"
        class="h-[1.75rem] w-[1.75rem]"
        :disabled="props.actionDisabled"
        @click="emit('action')"
      />
    </div>

    <div v-if="expanded" class="px-2 pb-2">
      <div class="flex flex-col gap-0 pl-5">
        <slot name="items" />
      </div>
    </div>

    <slot name="overlay" />
  </div>
</template>
