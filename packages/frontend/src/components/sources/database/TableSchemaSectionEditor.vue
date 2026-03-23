<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import {
  createCheckDraft,
  createColumnDraft,
  createForeignKeyDraft,
  createIndexDraft,
  createKeyDraft,
  createTriggerDraft,
  createVirtualColumnDraft,
  createVirtualForeignKeyDraft,
  type TableSchemaDraft,
  type TableSchemaMode,
  type TableSchemaSectionId,
} from '@/types/table-schema'
import type { DataSourceType } from '@/types/sql'

const schema = defineModel<TableSchemaDraft>('schema', { required: true })

const props = defineProps<{
  section: TableSchemaSectionId
  sourceType: DataSourceType
  mode: TableSchemaMode
}>()

const keyTypeOptions = [
  { label: 'Primary key', value: 'primary' },
  { label: 'Unique key', value: 'unique' },
]

const foreignKeyActionOptions = [
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL',
  'SET DEFAULT',
].map((value) => ({
  label: value,
  value,
}))

const virtualStorageOptions = [
  { label: 'Virtual', value: 'virtual' },
  { label: 'Stored', value: 'stored' },
]

const addEntry = () => {
  switch (props.section) {
    case 'columns':
      schema.value.columns.push(createColumnDraft())
      break
    case 'keys':
      schema.value.keys.push(createKeyDraft())
      break
    case 'foreignKeys':
      schema.value.foreignKeys.push(createForeignKeyDraft())
      break
    case 'indexes':
      schema.value.indexes.push(createIndexDraft())
      break
    case 'checks':
      schema.value.checks.push(createCheckDraft())
      break
    case 'triggers':
      schema.value.triggers.push(createTriggerDraft())
      break
    case 'virtualColumns':
      schema.value.virtualColumns.push(createVirtualColumnDraft())
      break
    case 'virtualForeignKeys':
      schema.value.virtualForeignKeys.push(createVirtualForeignKeyDraft())
      break
  }
}

const removeEntry = (index: number) => {
  switch (props.section) {
    case 'columns':
      schema.value.columns.splice(index, 1)
      break
    case 'keys':
      schema.value.keys.splice(index, 1)
      break
    case 'foreignKeys':
      schema.value.foreignKeys.splice(index, 1)
      break
    case 'indexes':
      schema.value.indexes.splice(index, 1)
      break
    case 'checks':
      schema.value.checks.splice(index, 1)
      break
    case 'triggers':
      schema.value.triggers.splice(index, 1)
      break
    case 'virtualColumns':
      schema.value.virtualColumns.splice(index, 1)
      break
    case 'virtualForeignKeys':
      schema.value.virtualForeignKeys.splice(index, 1)
      break
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 min-h-[26rem]">
    <div class="flex items-center justify-between gap-3">
      <div class="text-sm opacity-70">
        {{
          section === 'columns'
            ? 'Regular columns that are stored in the table.'
            : section === 'keys'
              ? 'Primary and unique keys for the table.'
              : section === 'foreignKeys'
                ? 'Database-level references to other tables.'
                : section === 'indexes'
                  ? 'Secondary indexes for lookups and sorts.'
                  : section === 'checks'
                    ? 'Constraint expressions enforced by the database.'
                    : section === 'triggers'
                      ? 'Raw CREATE TRIGGER SQL so each datasource can use its own syntax.'
                      : section === 'virtualColumns'
                        ? 'Generated columns backed by an expression.'
                        : 'App-level relations stored as datasource metadata.'
        }}
      </div>

      <Button
        icon="ti ti-plus"
        :label="section === 'columns' ? 'Add column' : 'Add entry'"
        size="small"
        severity="secondary"
        @click="addEntry"
      />
    </div>

    <div v-if="section === 'columns'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(column, index) in schema.columns"
        :key="column.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ column.name || `Column ${index + 1}` }}</div>
          <Button
            icon="ti ti-trash"
            text
            severity="secondary"
            size="small"
            :disabled="schema.columns.length === 1"
            @click="removeEntry(index)"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="column.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Type</label>
            <InputText v-model="column.type" fluid />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="column.nullable" binary />
            Nullable
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="column.primaryKey" binary />
            Primary key
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="column.autoIncrement" binary />
            Auto increment
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Default value</label>
          <SQLEditor v-model="column.defaultValue" :source-type="sourceType" placeholder="CURRENT_TIMESTAMP" />
        </div>
      </div>
    </div>

    <div v-else-if="section === 'keys'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(key, index) in schema.keys"
        :key="key.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ key.name || `Key ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="key.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Type</label>
            <Select v-model="key.type" :options="keyTypeOptions" option-label="label" option-value="value" fluid />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Columns</label>
          <InputText v-model="key.columns" fluid placeholder="id, tenant_id" />
        </div>
      </div>
    </div>

    <div v-else-if="section === 'foreignKeys'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(foreignKey, index) in schema.foreignKeys"
        :key="foreignKey.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ foreignKey.name || `Foreign key ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="foreignKey.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Columns</label>
            <InputText v-model="foreignKey.columns" fluid placeholder="user_id" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Referenced table</label>
            <InputText v-model="foreignKey.referencedTable" fluid placeholder="users" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Referenced columns</label>
            <InputText v-model="foreignKey.referencedColumns" fluid placeholder="id" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">On delete</label>
            <Select
              v-model="foreignKey.onDelete"
              :options="foreignKeyActionOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">On update</label>
            <Select
              v-model="foreignKey.onUpdate"
              :options="foreignKeyActionOptions"
              option-label="label"
              option-value="value"
              fluid
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="section === 'indexes'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(indexEntry, index) in schema.indexes"
        :key="indexEntry.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ indexEntry.name || `Index ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="indexEntry.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Columns</label>
            <InputText v-model="indexEntry.columns" fluid placeholder="created_at, user_id" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="indexEntry.unique" binary />
            Unique index
          </label>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Method</label>
            <InputText
              v-model="indexEntry.method"
              fluid
              :placeholder="sourceType === 'postgres' ? 'btree' : sourceType === 'mysql' ? 'BTREE' : 'Optional'"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="section === 'checks'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(check, index) in schema.checks"
        :key="check.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ check.name || `Check ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Name</label>
          <InputText v-model="check.name" fluid />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Expression</label>
          <SQLEditor v-model="check.expression" multiline height="7rem" :source-type="sourceType" />
        </div>
      </div>
    </div>

    <div v-else-if="section === 'triggers'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(trigger, index) in schema.triggers"
        :key="trigger.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ trigger.name || `Trigger ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Name</label>
          <InputText v-model="trigger.name" fluid />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">SQL</label>
          <SQLEditor
            v-model="trigger.sql"
            multiline
            height="10rem"
            :source-type="sourceType"
            placeholder="CREATE TRIGGER ..."
          />
        </div>
      </div>
    </div>

    <div v-else-if="section === 'virtualColumns'" class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(column, index) in schema.virtualColumns"
        :key="column.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ column.name || `Virtual column ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="column.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Type</label>
            <InputText v-model="column.type" fluid />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Storage</label>
            <Select
              v-model="column.storage"
              :options="virtualStorageOptions"
              option-label="label"
              option-value="value"
              fluid
              :disabled="sourceType === 'postgres'"
            />
          </div>
          <label class="flex items-center gap-2 text-sm pt-7">
            <Checkbox v-model="column.nullable" binary />
            Nullable
          </label>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Expression</label>
          <SQLEditor v-model="column.expression" multiline height="7rem" :source-type="sourceType" />
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col gap-3 overflow-auto pr-1">
      <div
        v-for="(relation, index) in schema.virtualForeignKeys"
        :key="relation.id"
        class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium">{{ relation.name || `Virtual foreign key ${index + 1}` }}</div>
          <Button icon="ti ti-trash" text severity="secondary" size="small" @click="removeEntry(index)" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Name</label>
            <InputText v-model="relation.name" fluid />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Columns</label>
            <InputText v-model="relation.columns" fluid placeholder="user_id" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Referenced table</label>
            <InputText v-model="relation.referencedTable" fluid placeholder="users" />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm opacity-70">Referenced columns</label>
            <InputText v-model="relation.referencedColumns" fluid placeholder="id" />
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-70">Display columns</label>
          <InputText v-model="relation.displayColumns" fluid placeholder="name, email" />
        </div>
      </div>
    </div>
  </div>
</template>
