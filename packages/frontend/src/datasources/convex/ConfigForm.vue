<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'

defineProps<{
  redactedSecretFields?: string[]
}>()

const config = defineModel<{
  deploymentUrl?: string
  adminKey?: string
  authToken?: string
}>('config', { required: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <label class="text-sm opacity-70">Deployment URL</label>
    <InputText
      size="small"
      v-model="config.deploymentUrl"
      fluid
      placeholder="https://your-deployment.convex.cloud"
    />
  </div>

  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Admin key</label>
      <Password
        size="small"
        v-model="config.adminKey"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('adminKey') ? 'Saved secret' : ''"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Function auth token</label>
      <Password
        size="small"
        v-model="config.authToken"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="redactedSecretFields?.includes('authToken') ? 'Saved secret' : 'Optional'"
      />
    </div>
  </div>

  <p class="text-xs opacity-60">
    The admin key is used for table browsing via Convex's streaming export APIs. The function auth
    token is optional and only needed for protected queries, mutations, or actions.
  </p>
</template>
