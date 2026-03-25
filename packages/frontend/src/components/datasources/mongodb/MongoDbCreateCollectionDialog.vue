<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

const props = defineProps<{
  database: string
}>()

const visible = defineModel<boolean>('visible', {
  default: false,
})

const emit = defineEmits<{
  create: [collectionName: string]
}>()

const collectionName = ref('')

watch(visible, (nextVisible) => {
  if (nextVisible) {
    collectionName.value = ''
  }
})

const canCreate = computed(() => Boolean(props.database.trim() && collectionName.value.trim()))

function submit() {
  if (!canCreate.value) {
    return
  }

  emit('create', collectionName.value.trim())
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="Create Collection"
    :style="{ width: '32rem' }"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Database</label>
        <InputText :model-value="database" disabled fluid size="small" />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Collection name</label>
        <InputText
          v-model="collectionName"
          fluid
          size="small"
          placeholder="orders"
          @keydown.enter.prevent="submit"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <Button
          label="Cancel"
          text
          severity="secondary"
          size="small"
          @click="visible = false"
        />
        <Button
          label="Create"
          icon="ti ti-plus"
          size="small"
          :disabled="!canCreate"
          @click="submit"
        />
      </div>
    </template>
  </Dialog>
</template>
