<script setup lang="ts">
import { computed } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import CollapsibleSection from '@/datasources/shared/CollapsibleSection.vue'
import {
  createDefaultSshTunnelConfig,
  createDefaultTlsConfig,
  type SshTunnelConfig,
  type TlsConfig,
} from '@/datasources/shared/transport'

const props = withDefaults(
  defineProps<{
    showSsh?: boolean
    showTls?: boolean
    redactedSecretFields?: string[]
    sshHint?: string
  }>(),
  {
    showSsh: false,
    showTls: false,
    sshHint: '',
  },
)

const config = defineModel<Record<string, unknown>>('config', {
  required: true,
  default: () => ({}),
})

const tlsModeOptions = [
  { value: 'disable', label: 'Disabled' },
  { value: 'require', label: 'Require TLS' },
  { value: 'verify-ca', label: 'Verify CA' },
  { value: 'verify-full', label: 'Verify Full' },
]

const sshAuthMethodOptions = [
  { value: 'password', label: 'Password' },
  { value: 'privateKey', label: 'Private key' },
]

function ensureConfigValue() {
  if (!config.value || typeof config.value !== 'object') {
    config.value = {}
  }

  return config.value
}

const tlsConfig = computed(() => {
  const configValue = ensureConfigValue()
  if (!configValue.tls || typeof configValue.tls !== 'object') {
    configValue.tls = createDefaultTlsConfig()
  }

  return configValue.tls as TlsConfig
})

const sshConfig = computed(() => {
  const configValue = ensureConfigValue()
  if (!configValue.ssh || typeof configValue.ssh !== 'object') {
    configValue.ssh = createDefaultSshTunnelConfig()
  }

  return configValue.ssh as SshTunnelConfig
})

function isSavedSecret(path: string) {
  return Boolean(path && props.redactedSecretFields?.includes(path))
}

const tlsSummary = computed(() => {
  if (tlsConfig.value.mode === 'disable') {
    return 'Disabled'
  }

  if (tlsConfig.value.mode === 'require') {
    return 'Enabled without certificate verification'
  }

  if (tlsConfig.value.mode === 'verify-ca') {
    return 'Verifying certificate chain'
  }

  return 'Verifying certificate chain and hostname'
})

const sshSummary = computed(() =>
  sshConfig.value.enabled
    ? `Enabled via ${sshConfig.value.host?.trim() || 'SSH host'}`
    : 'Disabled',
)
</script>

<template>
  <CollapsibleSection
    v-if="showTls"
    title="TLS / SSL"
    description="Certificate verification and optional client certificates."
    :summary="tlsSummary"
    :default-expanded="tlsConfig.mode !== 'disable'"
  >
    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Mode</label>
      <Select
        size="small"
        v-model="tlsConfig.mode"
        :options="tlsModeOptions"
        option-label="label"
        option-value="value"
        fluid
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Server name</label>
        <InputText
          size="small"
          v-model="tlsConfig.serverName"
          fluid
          placeholder="Optional override"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">CA certificate (PEM)</label>
        <Textarea
          v-model="tlsConfig.caCertPem"
          auto-resize
          rows="3"
          fluid
          placeholder="Optional"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Client certificate (PEM)</label>
        <Textarea
          v-model="tlsConfig.clientCertPem"
          auto-resize
          rows="3"
          fluid
          placeholder="Optional"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Client key (PEM)</label>
        <Textarea
          v-model="tlsConfig.clientKeyPem"
          auto-resize
          rows="3"
          fluid
          :placeholder="isSavedSecret('tls.clientKeyPem') ? 'Saved key' : 'Optional'"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm opacity-70">Client key passphrase</label>
      <Password
        size="small"
        v-model="tlsConfig.clientKeyPassphrase"
        fluid
        toggle-mask
        :feedback="false"
        :placeholder="isSavedSecret('tls.clientKeyPassphrase') ? 'Saved secret' : 'Optional'"
      />
    </div>
  </CollapsibleSection>

  <CollapsibleSection
    v-if="showSsh"
    title="SSH Tunnel"
    :description="
      sshHint || 'Optional jump-host tunnel before connecting to the datasource.'
    "
    :summary="sshSummary"
    :default-expanded="sshConfig.enabled"
  >
    <div class="flex items-center gap-3">
      <ToggleSwitch v-model="sshConfig.enabled" input-id="datasource-ssh-enabled" />
      <label for="datasource-ssh-enabled" class="text-sm opacity-70">Enable SSH tunneling</label>
    </div>

    <template v-if="sshConfig.enabled">
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">SSH host</label>
          <InputText size="small" v-model="sshConfig.host" fluid />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">SSH port</label>
          <InputNumber
            size="small"
            v-model="sshConfig.port"
            fluid
            :use-grouping="false"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">SSH username</label>
          <InputText size="small" v-model="sshConfig.username" fluid />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Authentication</label>
          <Select
            size="small"
            v-model="sshConfig.authMethod"
            :options="sshAuthMethodOptions"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>
      </div>

      <div v-if="sshConfig.authMethod === 'password'" class="flex flex-col gap-2">
        <label class="text-sm opacity-70">SSH password</label>
        <Password
          size="small"
          v-model="sshConfig.password"
          fluid
          toggle-mask
          :feedback="false"
          :placeholder="isSavedSecret('ssh.password') ? 'Saved secret' : ''"
        />
      </div>

      <div v-else class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Private key (PEM)</label>
          <Textarea
            v-model="sshConfig.privateKey"
            auto-resize
            rows="4"
            fluid
            :placeholder="isSavedSecret('ssh.privateKey') ? 'Saved key' : ''"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Passphrase</label>
          <Password
            size="small"
            v-model="sshConfig.passphrase"
            fluid
            toggle-mask
            :feedback="false"
            :placeholder="isSavedSecret('ssh.passphrase') ? 'Saved secret' : 'Optional'"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Remote host</label>
          <InputText
            size="small"
            v-model="sshConfig.remoteHost"
            fluid
            placeholder="Defaults to datasource host"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Remote port</label>
          <InputNumber
            size="small"
            v-model="sshConfig.remotePort"
            fluid
            :use-grouping="false"
            placeholder="Datasource port"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Host key fingerprint</label>
        <InputText
          size="small"
          v-model="sshConfig.hostKeyFingerprint"
          fluid
          placeholder="Optional SHA256 fingerprint"
        />
      </div>
    </template>
  </CollapsibleSection>
</template>
