<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import PermissionPatternField from '@/components/admin/PermissionPatternField.vue'
import type { AdminRoleRecord, PermissionTemplate } from '@/types/admin'

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit'
    initialValue?: AdminRoleRecord | null
    permissionTemplates?: PermissionTemplate[]
  }>(),
  {
    mode: 'create',
    initialValue: null,
    permissionTemplates: () => [],
  },
)

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      slug?: string
      description?: string | null
      permissions: string[]
    },
  ]
}>()

const name = ref('')
const slug = ref('')
const description = ref('')
const permissions = ref<string[]>([])

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    name.value = props.initialValue?.name ?? ''
    slug.value = props.initialValue?.slug ?? ''
    description.value = props.initialValue?.description ?? ''
    permissions.value = [...(props.initialValue?.permissions ?? [])]
  },
)

const header = computed(() => (props.mode === 'edit' ? 'Edit Role' : 'Create Role'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save role' : 'Create role'))
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: '46rem' }">
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Name</label>
          <InputText v-model="name" fluid placeholder="Readonly analyst" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Slug</label>
          <InputText v-model="slug" fluid placeholder="readonly-analyst" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Description</label>
        <Textarea v-model="description" auto-resize fluid :rows="2" placeholder="Can query reporting datasources only" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Permission patterns</label>
        <PermissionPatternField
          v-model="permissions"
          :helpers="permissionTemplates"
          placeholder="datasource.query.project-id.datasource-id"
        />
      </div>

      <div class="flex justify-end">
        <Button
          :label="submitLabel"
          icon="ti ti-shield"
          :disabled="!name.trim()"
          @click="
            emit('submit', {
              name: name.trim(),
              slug: slug.trim() || undefined,
              description: description.trim() || null,
              permissions,
            })
          "
        />
      </div>
    </div>
  </Dialog>
</template>
