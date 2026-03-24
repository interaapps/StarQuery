<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { ServerProfile } from '@/types/workspace'

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit'
    initialValue?: Partial<Pick<ServerProfile, 'name' | 'url' | 'kind'>> | null
  }>(),
  {
    mode: 'create',
    initialValue: null,
  },
)

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      url: string
      kind: 'local' | 'remote'
    },
  ]
}>()

const name = ref('')
const url = ref('http://127.0.0.1:3000')
const kind = ref<'local' | 'remote'>('remote')

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    name.value = props.initialValue?.name ?? ''
    url.value = props.initialValue?.url ?? 'http://127.0.0.1:3000'
    kind.value = 'remote'
  },
)

const canSubmit = computed(() => Boolean(name.value.trim() && url.value.trim()))
const header = computed(() => (props.mode === 'edit' ? 'Edit Server' : 'Add Server'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save server' : 'Add server'))
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: '32rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Display name</label>
        <InputText size="small" v-model="name" fluid placeholder="Production EU" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Base URL</label>
        <InputText size="small" v-model="url" fluid placeholder="http://127.0.0.1:3000" />
      </div>

      <div class="flex justify-end">
        <Button size="small"
          :label="submitLabel"
          icon="ti ti-server-2"
          :disabled="!canSubmit"
          @click="emit('submit', { name: name.trim(), url: kind === 'local' ? '' : url.trim(), kind })"
        />
      </div>
    </div>
  </Dialog>
</template>
