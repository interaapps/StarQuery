<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import type { AdminApiKeyRecord, AdminUserRecord } from '@/types/admin'

const props = defineProps<{
  apiKeys: AdminApiKeyRecord[]
  users: AdminUserRecord[]
  canManageApiKeys: boolean
}>()

defineEmits<{
  remove: [apiKey: AdminApiKeyRecord]
}>()

const userEmailMap = computed(() => new Map(props.users.map((user) => [user.id, user.email])))
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-3 mb-3">
      <div>
        <h2 class="text-lg font-semibold">API Keys</h2>
        <p class="text-sm opacity-70">
          Use these keys for automation or external provisioning calls.
        </p>
      </div>
    </div>

    <div class="rounded-2xl border app-border overflow-hidden">
      <div
        v-for="apiKey of apiKeys"
        :key="apiKey.id"
        class="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b last:border-b-0 app-border items-center"
      >
        <div>
          <div class="font-medium">{{ apiKey.name }}</div>
          <div class="text-sm opacity-65">
            {{ userEmailMap.get(apiKey.userId) || apiKey.userId }}
          </div>
        </div>

        <div class="mono text-sm opacity-70">{{ apiKey.tokenPrefix }}</div>

        <div class="text-sm opacity-70">
          {{
            apiKey.expiresAt
              ? `Expires ${new Date(apiKey.expiresAt).toLocaleString()}`
              : 'No expiry'
          }}
        </div>

        <Button
          v-if="canManageApiKeys"
          size="small"
          icon="ti ti-trash"
          text
          rounded
          severity="secondary"
          @click="$emit('remove', apiKey)"
        />
      </div>
    </div>
  </section>
</template>
