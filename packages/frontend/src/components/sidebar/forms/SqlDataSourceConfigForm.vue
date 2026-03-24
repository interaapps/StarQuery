<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'

const props = defineProps<{
  engine: 'mysql' | 'postgres'
  redactedSecretFields?: string[]
}>()

const config = defineModel<{
  host?: string
  port?: number | null
  user?: string
  password?: string
  database?: string
}>('config', { required: true })
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Host</label>
      <InputText v-model="config.host" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Port</label>
      <InputNumber v-model="config.port" fluid :use-grouping="false" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">User</label>
      <InputText v-model="config.user" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Password</label>
      <Password
        v-model="config.password"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="props.redactedSecretFields?.includes('password') ? 'Saved secret' : ''"
      />
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">{{ engine === 'postgres' ? 'Database' : 'Database' }}</label>
    <InputText v-model="config.database" fluid />
  </div>
</template>
