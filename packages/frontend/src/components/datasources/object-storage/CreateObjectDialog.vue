<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'

const visible = defineModel<boolean>('visible', { required: true })

const props = defineProps<{
  initialPath?: string
}>()

const emit = defineEmits<{
  submit: [
    payload: {
      path: string
      content: string
      contentType: string
    },
  ]
}>()

const objectPath = ref('')
const contentType = ref('text/plain')
const content = ref('')

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) {
      return
    }

    objectPath.value = props.initialPath ?? ''
    contentType.value = 'text/plain'
    content.value = ''
  },
)
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Create Object" :style="{ width: '40rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Object path</label>
        <InputText size="small" v-model="objectPath" fluid placeholder="bucket/path/file.txt" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Content type</label>
        <InputText size="small" v-model="contentType" fluid placeholder="text/plain" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Content</label>
        <Textarea size="small" v-model="content" fluid auto-resize :rows="10" />
      </div>

      <div class="flex justify-end">
        <Button size="small"
          label="Create object"
          icon="ti ti-file-plus"
          :disabled="!objectPath.trim()"
          @click="emit('submit', { path: objectPath.trim(), content, contentType: contentType.trim() || 'text/plain' })"
        />
      </div>
    </div>
  </Dialog>
</template>
