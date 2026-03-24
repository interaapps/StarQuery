<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import SelectButton from 'primevue/selectbutton'
import { getErrorMessage } from '@/services/error-message'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { AuthStorageMode } from '@/types/auth'

const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const email = ref('')
const password = ref('')
const errorMessage = ref<string | null>(null)
const storageOptions: Array<{ label: string; value: AuthStorageMode }> = [
  { label: 'Remember me', value: 'local' },
  { label: 'Session only', value: 'session' },
]

const submitLogin = async () => {
  errorMessage.value = null

  try {
    await authStore.login({
      email: email.value.trim(),
      password: password.value,
      storage: authStore.preferredStorage,
    })
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'The login request failed')
  }
}

const startOpenIdLogin = async () => {
  errorMessage.value = null

  try {
    authStore.startOpenIdLogin()
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'OpenID login could not be started')
  }
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center px-6 py-10">
    <div class="w-full max-w-[30rem] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm px-6 py-6">
      <div class="flex flex-col gap-2 mb-6">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Sign in</span>
        <h1 class="text-2xl font-semibold">Connect to {{ workspaceStore.currentServer?.name || 'StarQuery' }}</h1>
        <p class="text-sm opacity-70">
          Sign in to load workspaces, datasources, and admin features from this server.
        </p>
      </div>

      <Message v-if="workspaceStore.serverError" severity="warn" class="mb-4">
        {{ workspaceStore.serverError }}
      </Message>
      <Message v-if="errorMessage" severity="error" class="mb-4">
        {{ errorMessage }}
      </Message>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Email</label>
          <InputText size="small" v-model="email" fluid autocomplete="username" placeholder="you@example.com" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Password</label>
          <Password size="small"
            v-model="password"
            fluid
            toggle-mask
            :feedback="false"
            autocomplete="current-password"
            placeholder="Your password"
            @keyup.enter="submitLogin"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Token storage</label>
          <SelectButton
            v-model="authStore.preferredStorage"
            :options="storageOptions"
            option-label="label"
            option-value="value"
            size="small"
            :allow-empty="false"
          />
        </div>

        <div class="flex flex-col gap-3 pt-2">
          <Button size="small"
            label="Sign in"
            icon="ti ti-login-2"
            :loading="authStore.loading"
            :disabled="!email.trim() || !password"
            @click="submitLogin"
          />

          <Button size="small"
            v-if="authStore.status.openIdEnabled"
            label="Continue with OpenID"
            icon="ti ti-id-badge-2"
            severity="secondary"
            outlined
            @click="startOpenIdLogin"
          />
        </div>
      </div>
    </div>
  </div>
</template>
