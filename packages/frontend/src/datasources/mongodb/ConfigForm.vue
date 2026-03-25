<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ToggleSwitch from 'primevue/toggleswitch'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<{
  uri?: string
  host?: string
  port?: number | null
  username?: string
  password?: string
  database?: string
  authSource?: string
  ssl?: boolean
}>('config', { required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">MongoDB URI</label>
    <InputText size="small" v-model="config.uri" fluid placeholder="mongodb://localhost:27017/admin" />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Host</label>
      <InputText size="small" v-model="config.host" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Port</label>
      <InputNumber size="small" v-model="config.port" fluid :use-grouping="false" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Username</label>
      <InputText size="small" v-model="config.username" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Password</label>
      <Password
        size="small"
        v-model="config.password"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('password') ? 'Saved secret' : 'Optional'"
      />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Default database</label>
      <InputText size="small" v-model="config.database" fluid placeholder="admin" />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Auth source</label>
      <InputText size="small" v-model="config.authSource" fluid placeholder="Optional" />
    </div>
  </div>

  <div class="flex items-center gap-3">
    <ToggleSwitch v-model="config.ssl" input-id="mongodb-config-ssl" />
    <label for="mongodb-config-ssl" class="text-sm opacity-70">Use TLS / SSL</label>
  </div>
</template>
