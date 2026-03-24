<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import TableSchemaSectionEditor from '@/components/sources/database/TableSchemaSectionEditor.vue'
import {
  createEmptyTableSchemaState,
  loadTableSchemaState,
  serializeVirtualForeignKeys,
} from '@/datasources/shared-sql/schema/metadata'
import { buildCreateTableStatements, buildEditTableStatements } from '@/datasources/shared-sql/schema/sql'
import { getErrorMessage } from '@/services/error-message'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import {
  TABLE_SCHEMA_SECTIONS,
  createDefaultTableSchema,
  getTableSchemaSupport,
  type TableSchemaMode,
  type TableSchemaSectionId,
  type TableSchemaState,
} from '@/types/table-schema'
import type { DataSourceRecord } from '@/types/workspace'

const props = defineProps<{
  source: DataSourceRecord
  mode: TableSchemaMode
  tableName?: string | null
}>()

const visible = defineModel<boolean>('visible', { required: true })

const emit = defineEmits<{
  applied: [payload: { tableName: string }]
}>()

const workspaceStore = useWorkspaceStore()
const toast = useToast()

const isLoading = ref(false)
const isSaving = ref(false)
const state = ref<TableSchemaState>(createEmptyTableSchemaState())
const selectedSection = ref<TableSchemaSectionId>('columns')

const support = computed(() => getTableSchemaSupport(props.source.type, props.mode))
const availableSections = computed(() =>
  TABLE_SCHEMA_SECTIONS.filter((section) => support.value.sections.includes(section.id)),
)

const selectedSectionMeta = computed(
  () => availableSections.value.find((section) => section.id === selectedSection.value) ?? availableSections.value[0],
)

const isEditMode = computed(() => props.mode === 'edit')

const previewStatements = computed(() => {
  try {
    return isEditMode.value
      ? state.value.original
        ? buildEditTableStatements({
            sourceType: props.source.type,
            tableName: props.tableName || state.value.schema.name,
            original: state.value.original,
            next: state.value.schema,
          })
        : []
      : buildCreateTableStatements(props.source.type, state.value.schema)
  } catch (error) {
    return [error instanceof Error ? `-- ${error.message}` : '-- Preview unavailable']
  }
})

const virtualForeignKeyConfig = computed(() =>
  serializeVirtualForeignKeys(props.source, state.value.schema.name.trim(), state.value.schema.virtualForeignKeys),
)

const virtualForeignKeysChanged = computed(() => {
  const current = JSON.stringify(virtualForeignKeyConfig.value)
  const original = JSON.stringify(props.source.config ?? {})
  return current !== original
})

const canSubmit = computed(() => {
  if (!state.value.schema.name.trim()) return false
  return previewStatements.value.every((statement) => !statement.startsWith('--'))
})

const resetCreateMode = () => {
  const schema = createDefaultTableSchema()
  if (props.source.type === 'sqlite') {
    schema.keys = []
  }

  state.value = {
    schema,
    original: null,
  }
  selectedSection.value = availableSections.value[0]?.id ?? 'columns'
}

const load = async () => {
  if (!visible.value) return

  selectedSection.value = availableSections.value[0]?.id ?? 'columns'

  if (props.mode === 'create') {
    resetCreateMode()
    return
  }

  if (!workspaceStore.currentProjectId || !props.tableName) return

  isLoading.value = true
  try {
    const client = await workspaceStore.getClient()
    state.value = await loadTableSchemaState({
      client,
      projectId: workspaceStore.currentProjectId,
      source: props.source,
      tableName: props.tableName,
    })
  } finally {
    isLoading.value = false
  }
}

watch(
  () => [visible.value, props.tableName, props.source.id, props.mode] as const,
  async ([isVisible]) => {
    if (!isVisible) return
    await load()
  },
  { immediate: true },
)

watch(
  availableSections,
  (sections) => {
    if (!sections.find((section) => section.id === selectedSection.value)) {
      selectedSection.value = sections[0]?.id ?? 'columns'
    }
  },
  { immediate: true },
)

const applySchema = async () => {
  if (!workspaceStore.currentProjectId) return

  const statements = previewStatements.value.filter((statement) => !statement.startsWith('--'))
  if (!statements.length && !virtualForeignKeysChanged.value) {
    toast.add({
      severity: 'info',
      summary: 'No changes',
      detail: 'The table definition is already up to date.',
      life: 2000,
    })
    visible.value = false
    return
  }

  isSaving.value = true
  try {
    const client = await workspaceStore.getClient()

    if (statements.length) {
      await client.post(`/api/projects/${workspaceStore.currentProjectId}/sources/${props.source.id}/query`, {
        query: statements.join(';\n'),
      })
    }

    if (virtualForeignKeysChanged.value) {
      await workspaceStore.updateDataSource(props.source.id, {
        config: virtualForeignKeyConfig.value,
      })
    }

    const tableName = state.value.schema.name.trim()
    toast.add({
      severity: 'success',
      summary: props.mode === 'create' ? 'Table created' : 'Table updated',
      detail:
        props.mode === 'create'
          ? `${tableName} was created`
          : `${props.tableName || tableName} schema was updated`,
      life: 2200,
    })
    visible.value = false
    emit('applied', { tableName })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: props.mode === 'create' ? 'Table creation failed' : 'Table update failed',
      detail: getErrorMessage(error, 'The table schema could not be saved'),
      life: 4200,
    })
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="mode === 'create' ? 'Create Table' : 'Edit Table'"
    :style="{ width: '78rem' }"
    class="max-w-[calc(100vw-2rem)]"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-2 flex-1">
          <label class="text-sm opacity-70">Table name</label>
          <InputText size="small"
            v-model="state.schema.name"
            fluid
            :disabled="mode === 'edit'"
            :placeholder="mode === 'create' ? 'orders' : ''"
          />
        </div>

        <div class="text-xs opacity-60 max-w-[28rem] pt-7">
          <template v-if="source.type === 'sqlite' && mode === 'edit'">
            SQLite editing is currently focused on columns, indexes, triggers, and virtual foreign keys. More complex
            constraint editing is still best done through SQL for existing SQLite tables.
          </template>
          <template v-else>
            Edit the schema on the right. The SQL preview below is generated from these entries and executed as normal
            SQL against the datasource.
          </template>
        </div>
      </div>

      <div class="grid grid-cols-[14rem_minmax(0,1fr)] gap-4 min-h-[34rem]">
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-2 flex flex-col gap-1">
          <button
            v-for="section in availableSections"
            :key="section.id"
            type="button"
            class="text-left rounded-xl px-3 py-2 transition-colors"
            :class="
              selectedSection === section.id
                ? 'bg-primary-500/12 text-primary-700 dark:text-primary-300'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
            "
            @click="selectedSection = section.id"
          >
            <div class="flex items-center gap-2 text-sm font-medium">
              <i :class="section.icon" />
              <span>{{ section.label }}</span>
            </div>
            <div class="mt-1 text-xs opacity-60">{{ section.description }}</div>
          </button>
        </div>

        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 overflow-hidden">
          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <div class="text-sm font-medium">{{ selectedSectionMeta?.label }}</div>
              <div class="text-xs opacity-60">{{ selectedSectionMeta?.description }}</div>
            </div>
          </div>

          <div v-if="isLoading" class="py-8 text-sm opacity-60">Loading table schema...</div>
          <TableSchemaSectionEditor
            v-else
            v-model:schema="state.schema"
            :section="selectedSection"
            :source-type="source.type"
            :mode="mode"
          />
        </div>
      </div>

      <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div class="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs uppercase tracking-[0.16em] opacity-60 mono">
          SQL Preview
        </div>
        <div class="bg-neutral-950 text-neutral-100 p-4 mono text-xs overflow-auto max-h-[16rem]">
          <pre>{{ previewStatements.length ? previewStatements.join(';\n') : '-- No schema changes' }}</pre>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <div class="text-xs opacity-55">
          {{ mode === 'create' ? 'The preview runs as normal SQL after you confirm.' : 'Changed sections are diffed into ALTER / DROP / CREATE statements.' }}
        </div>

        <Button size="small"
          :label="mode === 'create' ? 'Create table' : 'Apply changes'"
          :icon="mode === 'create' ? 'ti ti-database-plus' : 'ti ti-device-floppy'"
          :loading="isSaving"
          :disabled="!canSubmit || isLoading"
          @click="applySchema"
        />
      </div>
    </div>
  </Dialog>
</template>
