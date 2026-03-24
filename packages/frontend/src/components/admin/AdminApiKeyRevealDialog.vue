<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'

defineProps<{
  apiKey: { token: string; tokenPrefix: string; userName: string } | null
}>()

const visible = defineModel<boolean>('visible', { required: true })

defineEmits<{
  copy: []
}>()
</script>

<template>
  <Dialog v-model:visible="visible" modal header="API Key Created" :style="{ width: '38rem' }">
    <div v-if="apiKey" class="flex flex-col gap-4">
      <Message severity="success">
        This token is shown only once for {{ apiKey.userName }}.
      </Message>

      <div
        class="rounded-xl border app-border bg-neutral-500/5 px-3 py-3 mono text-sm break-all"
      >
        {{ apiKey.token }}
      </div>

      <div class="flex justify-end">
        <Button size="small" icon="ti ti-copy" label="Copy token" @click="$emit('copy')" />
      </div>
    </div>
  </Dialog>
</template>
