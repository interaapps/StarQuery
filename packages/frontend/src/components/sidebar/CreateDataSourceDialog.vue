<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import {
  buildDataSourcePayload,
  canSubmitDataSourcePayload,
  createDataSourceFormState,
  listRegisteredDataSourceDefinitions,
} from '@/datasources/registry'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { RegisteredDataSourceDefinition } from '@/datasources/shared/module'
import type { DataSourceType } from '@/types/datasources'
import type { DataSourceRecord } from '@/types/workspace'

const visible = defineModel<boolean>('visible', { required: true })
const workspaceStore = useWorkspaceStore()

const props = defineProps<{
  source?: DataSourceRecord | null
}>()

const emit = defineEmits<{
  submit: [
    payload: {
      name: string
      type: DataSourceType
      config: Record<string, unknown>
    },
  ]
}>()

const name = ref('')
const type = ref<DataSourceType>('mysql')
const config = ref<Record<string, unknown>>({})
const redactedSecretFields = ref<string[]>([])
const definitions = computed(() => listRegisteredDataSourceDefinitions(workspaceStore.serverInfo))
const availableTypes = computed<DataSourceType[]>(() => definitions.value.map((definition) => definition.type))
const isEditing = computed(() => Boolean(props.source))
const typeOptions = computed(() =>
  definitions.value.map((definition) => ({
    value: definition.type,
    label: definition.label,
  })),
)
const currentDefinition = computed<RegisteredDataSourceDefinition | null>(
  () => definitions.value.find((definition) => definition.type === type.value) ?? null,
)
const currentFormComponent = computed(() => currentDefinition.value?.formComponent ?? null)
const currentFormProps = computed(() =>
  currentDefinition.value?.getFormProps?.({
    definition: currentDefinition.value,
    redactedSecretFields: redactedSecretFields.value,
    source: props.source,
  }) ?? {},
)

watch(
  () => visible.value,
  (nextVisible) => {
    if (!nextVisible) return
    const initialType = props.source?.type ?? (availableTypes.value[0] ?? 'mysql')
    const state = createDataSourceFormState(initialType, props.source)
    name.value = state.name
    type.value = state.type
    config.value = state.config
    redactedSecretFields.value = state.redactedSecretFields
  },
)

watch(type, (nextType) => {
  if (props.source?.type === nextType) {
    const state = createDataSourceFormState(nextType, props.source)
    config.value = state.config
    redactedSecretFields.value = state.redactedSecretFields
    return
  }

  const state = createDataSourceFormState(nextType)
  config.value = state.config
  redactedSecretFields.value = []
})

watch(availableTypes, (nextTypes) => {
  if (!nextTypes.includes(type.value)) {
    type.value = nextTypes[0] ?? 'mysql'
  }
})

const payload = computed(() =>
  buildDataSourcePayload({
    name: name.value,
    type: type.value,
    config: config.value,
    redactedSecretFields: redactedSecretFields.value,
  }),
)
const canSubmit = computed(() =>
  canSubmitDataSourcePayload({
    ...payload.value,
    redactedSecretFields: redactedSecretFields.value,
  }),
)
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="isEditing ? 'Edit Datasource' : 'Add Datasource'" :style="{ width: '36rem' }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Datasource name</label>
        <InputText size="small" v-model="name" fluid placeholder="warehouse" />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm opacity-70">Type</label>
        <Select size="small" v-model="type" :options="typeOptions" option-label="label" option-value="value" fluid />
      </div>

      <Component
        :is="currentFormComponent"
        v-if="currentFormComponent"
        v-model:config="config"
        v-bind="currentFormProps"
      />

      <div v-if="currentDefinition" class="rounded-xl border app-border px-3 py-2 text-xs opacity-65">
        {{ currentDefinition.capabilities.sqlQuery ? 'SQL datasource' : 'Resource datasource' }}
      </div>

      <div class="flex justify-end">
        <Button size="small"
          :label="isEditing ? 'Save datasource' : 'Create datasource'"
          :icon="isEditing ? 'ti ti-device-floppy' : 'ti ti-database-plus'"
          :disabled="!canSubmit"
          @click="emit('submit', payload)"
        />
      </div>
    </div>
  </Dialog>
</template>
