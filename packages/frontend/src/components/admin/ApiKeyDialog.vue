<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    userName?: string
  }>(),
  {
    userName: '',
  },
)

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      expiresInDays?: number | null
    },
  ]
}>()

const name = ref('')
const expiresInDays = ref<number | null>(null)

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    name.value = props.userName ? `${props.userName} API key` : ''
    expiresInDays.value = null
  },
)

const submitLabel = computed(() => 'Create API key')
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Create API Key" :style="{ width: '30rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Key name</label>
        <InputText size="small" v-model="name" fluid placeholder="CI integration" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Expires in days</label>
        <InputNumber size="small"
          v-model="expiresInDays"
          fluid
          :min="0"
          placeholder="Leave empty for server default, use 0 for no expiry"
        />
      </div>

      <div class="rounded-xl border app-border px-3 py-2 text-sm opacity-70">
        The full token is only shown once after creation.
      </div>

      <div class="flex justify-end">
        <Button size="small"
          :label="submitLabel"
          icon="ti ti-key"
          :disabled="!name.trim()"
          @click="emit('submit', { name: name.trim(), expiresInDays })"
        />
      </div>
    </div>
  </Dialog>
</template>
