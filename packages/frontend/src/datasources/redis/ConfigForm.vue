<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import TransportConfigSections from '@/datasources/shared/TransportConfigSections.vue'
import type { SshTunnelConfig, TlsConfig } from '@/datasources/shared/transport'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<{
  host?: string
  port?: number | null
  username?: string
  password?: string
  database?: number | null
  tls?: TlsConfig
  ssh?: SshTunnelConfig
}>('config', { required: true })
</script>

<template>
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
      <InputText size="small" v-model="config.username" fluid placeholder="Optional" />
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
      <label class="text-sm opacity-70">Database index</label>
      <InputNumber size="small" v-model="config.database" fluid :use-grouping="false" :min="0" />
    </div>
    <div />
  </div>

  <TransportConfigSections
    v-model:config="config"
    show-tls
    show-ssh
    :redacted-secret-fields="redactedSecretFields"
  />
</template>
