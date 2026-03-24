<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { ProjectRecord } from '@/types/workspace'

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit'
    initialValue?: Partial<Pick<ProjectRecord, 'name' | 'slug' | 'description'>> | null
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
      slug?: string
      description?: string
    },
  ]
}>()

const name = ref('')
const slug = ref('')
const description = ref('')

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    name.value = props.initialValue?.name ?? ''
    slug.value = props.initialValue?.slug ?? ''
    description.value = props.initialValue?.description ?? ''
  },
)

const header = computed(() => (props.mode === 'edit' ? 'Edit Workspace' : 'Create Workspace'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save workspace' : 'Create workspace'))
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: '34rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Project name</label>
        <InputText size="small" v-model="name" fluid placeholder="Analytics" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Slug</label>
        <InputText size="small" v-model="slug" fluid placeholder="analytics" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Description</label>
        <InputText size="small" v-model="description" fluid placeholder="Shared reporting workspace" />
      </div>

      <div class="flex justify-end">
        <Button size="small"
          :label="submitLabel"
          icon="ti ti-folder-plus"
          :disabled="!name.trim()"
          @click="emit('submit', { name: name.trim(), slug: slug.trim() || undefined, description: description.trim() || undefined })"
        />
      </div>
    </div>
  </Dialog>
</template>
