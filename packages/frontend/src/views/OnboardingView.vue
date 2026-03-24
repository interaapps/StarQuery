<script setup lang="ts">
import { computed, ref } from 'vue'
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

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const errorMessage = ref<string | null>(null)
const storageOptions: Array<{ label: string; value: AuthStorageMode }> = [
  { label: 'Remember me', value: 'local' },
  { label: 'Session only', value: 'session' },
]

const passwordsMatch = computed(() => password.value === confirmPassword.value)

const submitOnboarding = async () => {
  errorMessage.value = null

  if (!passwordsMatch.value) {
    errorMessage.value = 'The passwords do not match.'
    return
  }

  try {
    await authStore.onboard({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      storage: authStore.preferredStorage,
    })
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'The admin account could not be created')
  }
}
</script>

<template>
  <div class="h-full w-full flex items-center justify-center px-6 py-10">
    <div class="w-full max-w-[32rem] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 shadow-sm px-6 py-6">
      <div class="flex flex-col gap-2 mb-6">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Onboarding</span>
        <h1 class="text-2xl font-semibold">Create the first admin user</h1>
        <p class="text-sm opacity-70">
          {{ workspaceStore.currentServer?.name || 'This server' }} does not have any users yet. The first account gets full admin access.
        </p>
      </div>

      <Message v-if="workspaceStore.serverError" severity="warn" class="mb-4">
        {{ workspaceStore.serverError }}
      </Message>
      <Message v-if="errorMessage" severity="error" class="mb-4">
        {{ errorMessage }}
      </Message>

      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="name" fluid placeholder="Server Admin" />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Email</label>
            <InputText v-model="email" fluid placeholder="admin@example.com" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Password</label>
            <Password
              v-model="password"
              fluid
              toggle-mask
              autocomplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Confirm password</label>
            <Password
              v-model="confirmPassword"
              fluid
              toggle-mask
              :feedback="false"
              autocomplete="new-password"
              placeholder="Repeat password"
              @keyup.enter="submitOnboarding"
            />
          </div>
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

        <div class="flex justify-end pt-2">
          <Button
            label="Create admin account"
            icon="ti ti-shield-check"
            :loading="authStore.loading"
            :disabled="!name.trim() || !email.trim() || password.length < 8 || !passwordsMatch"
            @click="submitOnboarding"
          />
        </div>
      </div>
    </div>
  </div>
</template>
