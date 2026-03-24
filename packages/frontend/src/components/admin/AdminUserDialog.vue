<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Password from 'primevue/password'
import PermissionPatternField from '@/components/admin/PermissionPatternField.vue'
import type { AdminRoleRecord, AdminUserRecord, PermissionTemplate } from '@/types/admin'

const visible = defineModel<boolean>('visible', { required: true })
const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit'
    initialValue?: AdminUserRecord | null
    roles?: AdminRoleRecord[]
    permissionTemplates?: PermissionTemplate[]
  }>(),
  {
    mode: 'create',
    initialValue: null,
    roles: () => [],
    permissionTemplates: () => [],
  },
)

const emit = defineEmits<{
  submit: [
    payload: {
      email: string
      name: string
      password?: string
      permissions: string[]
      roleIds: string[]
      disabled: boolean
    },
  ]
}>()

const email = ref('')
const name = ref('')
const password = ref('')
const permissions = ref<string[]>([])
const roleIds = ref<string[]>([])
const disabled = ref(false)

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    email.value = props.initialValue?.email ?? ''
    name.value = props.initialValue?.name ?? ''
    password.value = ''
    permissions.value = [...(props.initialValue?.permissions ?? [])]
    roleIds.value = [...(props.initialValue?.roleIds ?? [])]
    disabled.value = props.initialValue?.disabled ?? false
  },
)

const header = computed(() => (props.mode === 'edit' ? 'Edit User' : 'Create User'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save user' : 'Create user'))
const roleOptions = computed(() => props.roles.map((role) => ({ label: role.name, value: role.id })))
const passwordRequired = computed(() => props.mode === 'create')
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" :style="{ width: '48rem' }">
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Name</label>
          <InputText size="small" v-model="name" fluid placeholder="Jane Admin" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Email</label>
          <InputText size="small" v-model="email" fluid placeholder="jane@example.com" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4 items-start">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">
            {{ passwordRequired ? 'Password' : 'Password reset (optional)' }}
          </label>
          <Password size="small"
            v-model="password"
            fluid
            toggle-mask
            :feedback="passwordRequired"
            :placeholder="passwordRequired ? 'At least 8 characters' : 'Leave empty to keep current password'"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Roles</label>
          <MultiSelect size="small"
            v-model="roleIds"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            fluid
            display="chip"
            placeholder="Assign roles"
          />
        </div>
      </div>

      <label class="flex items-center gap-2 text-sm opacity-80">
        <Checkbox v-model="disabled" binary />
        Disable user sign-in
      </label>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Direct permission patterns</label>
        <PermissionPatternField
          v-model="permissions"
          :helpers="permissionTemplates"
          placeholder="admin.users"
        />
      </div>

      <div class="flex justify-end">
        <Button size="small"
          :label="submitLabel"
          icon="ti ti-user-plus"
          :disabled="!name.trim() || !email.trim() || (passwordRequired && password.length < 8)"
          @click="
            emit('submit', {
              email: email.trim(),
              name: name.trim(),
              password: password.trim() || undefined,
              permissions,
              roleIds,
              disabled,
            })
          "
        />
      </div>
    </div>
  </Dialog>
</template>
