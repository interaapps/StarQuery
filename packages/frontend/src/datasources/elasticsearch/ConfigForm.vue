<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import TransportConfigSections from '@/datasources/shared/TransportConfigSections.vue'
import type { SshTunnelConfig, TlsConfig } from '@/datasources/shared/transport'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<{
  node?: string
  username?: string
  password?: string
  apiKey?: string
  index?: string
  tls?: TlsConfig
  ssh?: SshTunnelConfig
}>('config', { required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">Node URL</label>
    <InputText size="small" v-model="config.node" fluid placeholder="http://127.0.0.1:9200" />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Username</label>
      <InputText size="small" v-model="config.username" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Password</label>
      <Password size="small"
        v-model="config.password"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('password') ? 'Saved secret' : ''"
      />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">API key</label>
      <Password size="small"
        v-model="config.apiKey"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('apiKey') ? 'Saved secret' : ''"
      />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Default index</label>
      <InputText size="small" v-model="config.index" fluid placeholder="Optional" />
    </div>
  </div>

  <TransportConfigSections
    v-model:config="config"
    show-tls
    show-ssh
    :redacted-secret-fields="redactedSecretFields"
  />
</template>
