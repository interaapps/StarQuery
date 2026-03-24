<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import ToggleSwitch from 'primevue/toggleswitch'

const props = withDefaults(
  defineProps<{
    providerLabel?: string
    redactedSecretFields?: string[]
  }>(),
  {
    providerLabel: 'S3-compatible storage',
  },
)

const config = defineModel<{
  endPoint?: string
  port?: number | null
  useSSL?: boolean
  pathStyle?: boolean
  accessKey?: string
  secretKey?: string
  sessionToken?: string
  region?: string
  bucket?: string
}>('config', { required: true })
</script>

<template>
  <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 text-xs opacity-65">
    {{ props.providerLabel }}
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Endpoint</label>
      <InputText size="small" v-model="config.endPoint" fluid placeholder="s3.amazonaws.com" />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Port</label>
      <InputNumber size="small" v-model="config.port" fluid :use-grouping="false" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Access key</label>
      <InputText size="small" v-model="config.accessKey" fluid />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Secret key</label>
      <Password size="small"
        v-model="config.secretKey"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('secretKey') ? 'Saved secret' : ''"
      />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Session token</label>
      <Password size="small"
        v-model="config.sessionToken"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('sessionToken') ? 'Saved token' : 'Optional'"
      />
    </div>
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Region</label>
      <InputText size="small" v-model="config.region" fluid placeholder="Optional" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Default bucket</label>
      <InputText size="small" v-model="config.bucket" fluid placeholder="Optional" />
    </div>
    <div class="flex flex-col gap-2 justify-end">
      <div class="flex items-center gap-3 pt-6">
        <ToggleSwitch v-model="config.useSSL" input-id="s3-use-ssl" />
        <label for="s3-use-ssl" class="text-sm opacity-70">Use SSL</label>
      </div>
    </div>
  </div>

  <div class="flex items-center gap-3 pt-1">
    <ToggleSwitch v-model="config.pathStyle" input-id="s3-path-style" />
    <label for="s3-path-style" class="text-sm opacity-70">Use path-style URLs</label>
  </div>
</template>
