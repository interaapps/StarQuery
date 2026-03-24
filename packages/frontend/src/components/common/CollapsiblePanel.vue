<script setup lang="ts">
import Button from 'primevue/button'
import SectionLabel from '@/components/common/SectionLabel.vue'

const expanded = defineModel<boolean>('expanded', { required: true })

withDefaults(
  defineProps<{
    title?: string
    rootClass?: string
    headerClass?: string
    bodyClass?: string
    titleClass?: string
    disabled?: boolean
  }>(),
  {
    title: '',
    rootClass: '',
    headerClass: '',
    bodyClass: '',
    titleClass: 'opacity-60',
    disabled: false,
  },
)
</script>

<template>
  <section :class="rootClass">
    <div class="flex items-center justify-between px-3 py-0.5" :class="headerClass">
      <div class="min-w-0 flex items-center gap-3">
        <slot name="title">
          <SectionLabel v-if="title" :text="title" :class="titleClass" />
        </slot>
        <slot name="meta" />
      </div>

      <div class="flex items-center gap-0.5">
        <slot name="actions" />
        <Button
          :icon="`ti ${expanded ? 'ti-minus' : 'ti-plus'}`"
          size="small"
          text
          severity="secondary"
          :disabled="disabled"
          @click="expanded = !expanded"
        />
      </div>
    </div>

    <div v-if="expanded" :class="bodyClass">
      <slot />
    </div>
  </section>
</template>
