<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import TransportConfigSections from '@/datasources/shared/TransportConfigSections.vue'
import type { SshTunnelConfig, TlsConfig } from '@/datasources/shared/transport'

defineProps<{
  engine: 'mysql' | 'mariadb' | 'postgres' | 'cockroachdb' | 'mssql' | 'clickhouse' | 'oracle' | 'cassandra'
  redactedSecretFields?: string[]
  userLabel?: string
  passwordLabel?: string
  databaseLabel?: string
  schemaLabel?: string
  databasePlaceholder?: string
  showSchema?: boolean
  showTls?: boolean
  showSsh?: boolean
  optionalUser?: boolean
  optionalPassword?: boolean
  optionalDatabase?: boolean
}>()

const config = defineModel<{
  host?: string
  port?: number | null
  user?: string
  password?: string
  database?: string
  schema?: string
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
      <label class="text-sm opacity-70">{{ userLabel ?? 'User' }}</label>
      <InputText size="small" v-model="config.user" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">{{ passwordLabel ?? 'Password' }}</label>
      <Password size="small"
        v-model="config.password"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="
          redactedSecretFields?.includes('password')
            ? 'Saved secret'
            : optionalPassword
              ? 'Optional'
              : ''
        "
      />
    </div>
  </div>

  <div class="grid gap-3" :class="showSchema ? 'grid-cols-2' : 'grid-cols-1'">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">{{ databaseLabel ?? 'Database' }}</label>
      <InputText
        size="small"
        v-model="config.database"
        fluid
        :placeholder="databasePlaceholder ?? (optionalDatabase ? 'Optional' : '')"
      />
    </div>

    <div v-if="showSchema" class="flex flex-col gap-2">
      <label class="text-sm opacity-70">{{ schemaLabel ?? 'Schema' }}</label>
      <InputText size="small" v-model="config.schema" fluid placeholder="Optional" />
    </div>
  </div>

  <TransportConfigSections
    v-if="showTls || showSsh"
    v-model:config="config"
    :show-tls="showTls"
    :show-ssh="showSsh"
    :redacted-secret-fields="redactedSecretFields"
  />
</template>
