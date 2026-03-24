<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { SQLNamespace } from '@codemirror/lang-sql'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { buildSqlCompletionCatalog } from '@/datasources/shared-sql/completion'
import {
  buildTableQuery,
  normalizeOrderByClause,
  normalizeWhereClause,
  quoteIdentifier,
} from '@/datasources/shared-sql/query'
import CollapsibleActivityPanel from '@/components/sql/CollapsibleActivityPanel.vue'
import LoadingContainer from '@/components/LoadingContainer.vue'
import type { SQLActivityEntry } from '@/components/sql/SQLActivityPanel.vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import ExtendedDataTable from '@/components/table/ExtendedDataTable.vue'
import { createBackendClient } from '@/services/backend-api'
import { getErrorMessage } from '@/services/error-message'
import { dataSourceReadPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import { isSqlTableTab } from '@/types/tabs'
import type {
  DataSourceType,
  SQLExecutionResult,
  SQLTableColumn,
  SQLTableDetails,
  SQLTableRowDraft,
  SQLTableTabData,
} from '@/types/sql'

const props = defineProps<{
  tabId?: string
  data: SQLTableTabData
}>()

const extendedDataTable = useTemplateRef<typeof ExtendedDataTable>('extendedDataTable')
const toast = useToast()
const authStore = useAuthStore()
const tabsStore = useTabsStore()
const workspaceStore = useWorkspaceStore()
const client = createBackendClient(props.data.serverUrl)

const isLoading = ref(true)
const isSaving = ref(false)
const tableDetails = ref<SQLTableDetails | null>(null)
const columns = ref<SQLTableColumn[]>([])
const rows = ref<SQLTableRowDraft[]>([])
const page = ref(1)
const pageSize = ref(50)
const total = ref(0)
const whereInput = ref(props.data.whereClause ?? '')
const appliedWhereClause = ref(props.data.whereClause?.trim() ?? '')
const sortInput = ref(props.data.sortClause ?? '')
const appliedSortClause = ref(props.data.sortClause?.trim() ?? '')
const activityLogs = ref<SQLActivityEntry[]>([])
const logsVisible = ref(true)
const logsHeight = ref(160)
const completionSchema = ref<SQLNamespace>()
const completionDefaultSchema = ref<string>()

const pushLog = (entry: Omit<SQLActivityEntry, 'id'>) => {
  activityLogs.value = [
    {
      id: `${entry.level}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...entry,
    },
    ...activityLogs.value,
  ].slice(0, 20)
}

const createRowId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`

const pad = (value: number) => String(value).padStart(2, '0')

const getTemporalKind = (column: SQLTableColumn) => {
  const type = (column.type || '').toLowerCase()

  if (/\b(timestamp|datetime)\b/.test(type)) return 'datetime'
  if (/\btime\b/.test(type) && !/\b(timestamp|datetime)\b/.test(type)) return 'time'
  if (/\bdate\b/.test(type)) return 'date'

  return null
}

const formatDateValue = (value: Date, kind: 'date' | 'datetime' | 'time') => {
  if (kind === 'date') {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }

  if (kind === 'time') {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

const normalizeTemporalString = (value: string, kind: 'date' | 'datetime' | 'time') => {
  const trimmed = value.trim()
  if (!trimmed) {
    return trimmed
  }

  if (kind === 'date') {
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    return dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : trimmed
  }

  if (kind === 'time') {
    const timeMatch = trimmed.match(/(\d{2}):(\d{2})(?::(\d{2}))?/)
    return timeMatch ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] ?? '00'}` : trimmed
  }

  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  )
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]} ${isoMatch[4]}:${isoMatch[5]}:${isoMatch[6] ?? '00'}`
  }

  return trimmed
}

const normalizeCellValue = (column: SQLTableColumn, value: unknown) => {
  const kind = getTemporalKind(column)
  if (!kind) {
    return value
  }

  if (value instanceof Date) {
    return formatDateValue(value, kind)
  }

  if (typeof value === 'string') {
    return normalizeTemporalString(value, kind)
  }

  return value
}

const serializeRowForSave = (rowValues: Record<string, unknown>) =>
  Object.fromEntries(
    columns.value.map((column) => [
      column.field,
      normalizeCellValue(column, rowValues[column.field]),
    ]),
  )

const buildDraftRows = (resultRows: Record<string, unknown>[]) =>
  resultRows.map((row) => {
    const normalized = Object.fromEntries(
      columns.value.map((column) => [column.field, normalizeCellValue(column, row[column.field])]),
    )

    return {
      id: createRowId(),
      values: normalized,
      original: { ...normalized },
      state: 'clean' as const,
    }
  })

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const dirtyRows = computed(() => rows.value.filter((row) => row.state !== 'clean'))
const defaultSortColumn = computed(
  () => tableDetails.value?.primaryKeys[0] ?? tableDetails.value?.columns[0]?.name ?? null,
)
const defaultSortClause = computed(() =>
  defaultSortColumn.value
    ? `${quoteIdentifier(defaultSortColumn.value, sourceType.value)} ASC`
    : '',
)

const isGeneratedDefaultValue = (value: unknown) => {
  if (typeof value !== 'string') {
    return false
  }

  const normalized = value.trim().toLowerCase()
  return [
    'current_timestamp',
    'current_timestamp()',
    'current_date',
    'current_date()',
    'current_time',
    'current_time()',
    'localtimestamp',
    'localtimestamp()',
    'now()',
    'uuid()',
    'gen_random_uuid()',
  ].includes(normalized)
}

const shouldOmitInsertedValue = (column: SQLTableColumn, value: unknown) =>
  value == null && (column.autoIncrement === true || isGeneratedDefaultValue(column.defaultValue))
const hasPendingChanges = computed(() => dirtyRows.value.length > 0)
const sourceRecord = computed(() =>
  workspaceStore.dataSources.find((source) => source.id === props.data.sourceId),
)
const sourceType = computed<DataSourceType>(
  () => props.data.sourceType ?? sourceRecord.value?.type ?? 'mysql',
)
const canQueryTable = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)
const canEditTable = computed(() =>
  authStore.hasPermission(
    dataSourceReadPermissionTargets(props.data.projectId, props.data.sourceId),
  ),
)

const tabIndex = computed(() =>
  tabsStore.tabs.findIndex((tab) =>
    props.tabId
      ? tab.id === props.tabId
      : isSqlTableTab(tab) &&
        tab.data.sourceId === props.data.sourceId &&
        tab.data.tableName === props.data.tableName,
  ),
)

const updateTabData = (patch: Partial<SQLTableTabData>) => {
  if (tabIndex.value === -1) return

  tabsStore.updateTab(tabIndex.value, {
    data: {
      ...props.data,
      ...patch,
    },
  })
}

watch(
  hasPendingChanges,
  (dirty) => {
    if (tabIndex.value !== -1) {
      tabsStore.updateTab(tabIndex.value, { dirty })
    }
  },
  { immediate: true },
)

const fetchTableDetails = async () => {
  const details = (
    await client.get(
      `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/tables/${props.data.tableName}`,
    )
  ).data as SQLTableDetails
  tableDetails.value = details
  if (sourceRecord.value) {
    const catalog = buildSqlCompletionCatalog({
      source: sourceRecord.value,
      tables: [details],
      defaultTable: details.name,
    })
    completionSchema.value = catalog.schema
    completionDefaultSchema.value = catalog.defaultSchema
  }

  if (!appliedSortClause.value && defaultSortClause.value) {
    sortInput.value = props.data.sortClause?.trim() || defaultSortClause.value
    appliedSortClause.value = props.data.sortClause?.trim() || defaultSortClause.value
  }
}

const loadRows = async (options?: {
  page?: number
  pageSize?: number
  sortClause?: string
  whereClause?: string
}) => {
  isLoading.value = true
  const startedAt = performance.now()

  const requestedPage = options?.page ?? page.value
  const requestedPageSize = options?.pageSize ?? pageSize.value
  const requestedSortClause =
    options?.sortClause ?? appliedSortClause.value ?? defaultSortClause.value
  const requestedWhereClause = options?.whereClause ?? appliedWhereClause.value
  let executedQuery: string | undefined

  try {
    if (!tableDetails.value) {
      await fetchTableDetails()
    }

    if (!tableDetails.value) {
      throw new Error('The table definition could not be loaded')
    }

    const fallbackOrderByClause = defaultSortClause.value
    if (!fallbackOrderByClause) {
      throw new Error('The table does not expose any sortable columns')
    }

    const query = buildTableQuery({
      sourceType: sourceType.value,
      tableName: props.data.tableName,
      orderByClause: requestedSortClause,
      fallbackOrderByClause,
      page: requestedPage,
      pageSize: requestedPageSize,
      whereClause: requestedWhereClause,
    })
    executedQuery = query

    const response = (
      await client.post(
        `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/query`,
        {
          query,
        },
      )
    ).data as {
      results: SQLExecutionResult[]
    }

    const [countResult, rowsResult] = response.results
    if (countResult?.type !== 'SELECT' || rowsResult?.type !== 'SELECT') {
      throw new Error('The table query did not return the expected result set')
    }

    const countColumn = countResult.columns[0]
    const nextTotal = Number(countResult.rows[0]?.[countColumn] ?? 0)
    const visibleColumns = rowsResult.columns.length
      ? rowsResult.columns
      : tableDetails.value.columns.map((column) => column.name)

    columns.value = visibleColumns.map((columnName) => {
      const column = tableDetails.value!.columns.find((entry) => entry.name === columnName)
      return column
        ? {
            ...column,
            field: column.field || column.name,
          }
        : {
            name: columnName,
            field: columnName,
          }
    })
    rows.value = buildDraftRows(rowsResult.rows)
    total.value = Number.isFinite(nextTotal) ? nextTotal : 0
    page.value = requestedPage
    pageSize.value = Math.max(requestedPageSize, 1)
    appliedSortClause.value = normalizeOrderByClause(requestedSortClause) ?? fallbackOrderByClause
    return {
      ok: true,
      durationMs: Math.round(performance.now() - startedAt),
      query,
    }
  } catch (error) {
    const detail = getErrorMessage(error, 'The table rows could not be loaded')

    pushLog({
      level: 'error',
      title: 'Load failed',
      message: detail,
      sql: executedQuery,
      durationMs: Math.round(performance.now() - startedAt),
    })

    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail,
      life: 2800,
    })
    return {
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      query: executedQuery,
    }
  } finally {
    isLoading.value = false
  }
}

const refreshTable = async () => {
  if (!canQueryTable.value) return
  await fetchTableDetails()
  await loadRows()
}

const guardPendingChanges = () => {
  if (!hasPendingChanges.value) return false

  toast.add({
    severity: 'warn',
    summary: 'Unsaved changes',
    detail: 'Save or discard your current page before changing pagination or sorting.',
    life: 2200,
  })
  pushLog({
    level: 'info',
    title: 'Unsaved changes',
    message: 'Save or discard your current page before changing pagination or sorting.',
  })
  return true
}

const saveChanges = async () => {
  if (!canEditTable.value || !tableDetails.value) return
  isSaving.value = true
  const startedAt = performance.now()

  try {
    const insertedRows = rows.value
      .filter((row) => row.state === 'new')
      .map((row) =>
        Object.fromEntries(
          columns.value.flatMap((column) =>
            shouldOmitInsertedValue(column, row.values[column.field])
              ? []
              : [[column.field, normalizeCellValue(column, row.values[column.field])]],
          ),
        ),
      )

    const updatedRows = rows.value
      .filter((row) => row.state === 'modified' && row.original)
      .map((row) => {
        const changes = Object.fromEntries(
          columns.value
            .filter((column) => row.values[column.field] !== row.original?.[column.field])
            .map((column) => [column.field, normalizeCellValue(column, row.values[column.field])]),
        )

        return {
          original: serializeRowForSave(row.original!),
          changes,
        }
      })

    const deletedRows = rows.value
      .filter((row) => row.state === 'deleted' && row.original)
      .map((row) => serializeRowForSave(row.original!))

    await client.post(
      `/api/projects/${props.data.projectId}/sources/${props.data.sourceId}/tables/${props.data.tableName}/save`,
      {
        primaryKeys: tableDetails.value.primaryKeys,
        insertedRows,
        updatedRows,
        deletedRows,
      },
    )

    toast.add({
      severity: 'success',
      summary: 'Changes saved',
      detail: `${insertedRows.length + updatedRows.length + deletedRows.length} change set(s) applied`,
      life: 2200,
    })
    pushLog({
      level: 'success',
      title: 'Changes saved',
      message: `${insertedRows.length + updatedRows.length + deletedRows.length} change set(s) applied`,
      durationMs: Math.round(performance.now() - startedAt),
    })

    await loadRows()
  } catch (error) {
    const detail = getErrorMessage(error, 'The table changes could not be saved')
    pushLog({
      level: 'error',
      title: 'Save failed',
      message: detail,
      durationMs: Math.round(performance.now() - startedAt),
    })
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail,
      life: 2600,
    })
  } finally {
    isSaving.value = false
  }
}

const discardChanges = async () => {
  if (!canQueryTable.value) return
  await loadRows()
  toast.add({
    severity: 'info',
    summary: 'Changes discarded',
    detail: `Reloaded ${props.data.tableName}`,
    life: 1800,
  })
  pushLog({
    level: 'info',
    title: 'Changes discarded',
    message: `Reloaded ${props.data.tableName}`,
  })
}

const changePage = async (nextPage: number) => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return
  await loadRows({
    page: Math.min(Math.max(nextPage, 1), pageCount.value),
  })
}

const changePageSize = async (nextPageSize: number) => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return
  await loadRows({
    pageSize: nextPageSize,
    page: 1,
  })
}

const applyWhereClause = async () => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return

  const nextWhereClause = whereInput.value.trim()
  let normalizedWhereClause = ''

  try {
    normalizedWhereClause = normalizeWhereClause(nextWhereClause) ?? ''
  } catch (error) {
    pushLog({
      level: 'error',
      title: 'Invalid WHERE filter',
      message: error instanceof Error ? error.message : 'The WHERE filter is invalid',
    })
    toast.add({
      severity: 'error',
      summary: 'Invalid WHERE filter',
      detail: error instanceof Error ? error.message : 'The WHERE filter is invalid',
      life: 2800,
    })
    return
  }

  whereInput.value = nextWhereClause
  const result = await loadRows({
    whereClause: normalizedWhereClause,
    page: 1,
  })
  if (!result.ok) return

  whereInput.value = normalizedWhereClause
  appliedWhereClause.value = normalizedWhereClause
  updateTabData({ whereClause: normalizedWhereClause || undefined })
  pushLog({
    level: 'success',
    title: 'Filter applied',
    message: normalizedWhereClause ? `WHERE ${normalizedWhereClause}` : 'Filter cleared',
    sql: result.query,
    durationMs: result.durationMs,
  })
}

const applySortClause = async () => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return

  let normalizedSortClause = ''

  try {
    normalizedSortClause = normalizeOrderByClause(sortInput.value) ?? defaultSortClause.value
  } catch (error) {
    pushLog({
      level: 'error',
      title: 'Invalid ORDER BY',
      message: error instanceof Error ? error.message : 'The ORDER BY clause is invalid',
    })
    toast.add({
      severity: 'error',
      summary: 'Invalid ORDER BY',
      detail: error instanceof Error ? error.message : 'The ORDER BY clause is invalid',
      life: 2800,
    })
    return
  }

  if (!normalizedSortClause) {
    return
  }

  sortInput.value = normalizedSortClause
  const result = await loadRows({
    sortClause: normalizedSortClause,
    page: 1,
  })
  if (!result.ok) return

  appliedSortClause.value = normalizedSortClause
  updateTabData({ sortClause: normalizedSortClause || undefined })
  pushLog({
    level: 'success',
    title: 'Sort applied',
    message: `ORDER BY ${normalizedSortClause}`,
    sql: result.query,
    durationMs: result.durationMs,
  })
}

const resetSortClause = async () => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return
  if (!defaultSortClause.value) return

  sortInput.value = defaultSortClause.value
  const result = await loadRows({
    sortClause: defaultSortClause.value,
    page: 1,
  })
  if (!result.ok) return

  appliedSortClause.value = defaultSortClause.value
  updateTabData({ sortClause: defaultSortClause.value || undefined })
  pushLog({
    level: 'info',
    title: 'Sort reset',
    message: `ORDER BY ${defaultSortClause.value}`,
    sql: result.query,
    durationMs: result.durationMs,
  })
}

const clearWhereClause = async () => {
  if (!canQueryTable.value) return
  if (guardPendingChanges()) return
  if (!whereInput.value && !appliedWhereClause.value) return

  const previousWhereInput = whereInput.value
  whereInput.value = ''
  const result = await loadRows({
    whereClause: '',
    page: 1,
  })
  if (!result.ok) {
    whereInput.value = previousWhereInput
    return
  }

  appliedWhereClause.value = ''
  updateTabData({ whereClause: undefined })
  pushLog({
    level: 'info',
    title: 'Filter cleared',
    message: 'The table filter has been removed.',
    sql: result.query,
    durationMs: result.durationMs,
  })
}

onMounted(async () => {
  await fetchTableDetails()
  if (canQueryTable.value) {
    await loadRows()
    return
  }

  isLoading.value = false
  pushLog({
    level: 'info',
    title: 'Read-only metadata access',
    message: 'This server account can inspect the table definition but cannot load rows from it.',
  })
})
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <div
      class="border-b border-neutral-200 dark:border-neutral-800 flex h-[2.5rem] items-center px-2 justify-between gap-3"
    >
      <div class="flex items-center gap-0.5">
        <Button
          size="small"
          :icon="`ti ti-refresh ${isLoading ? 'animate-spin' : ''}`"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canQueryTable"
          @click="refreshTable"
        />
        <Button
          size="small"
          icon="ti ti-device-floppy"
          class="size-[1.8rem]"
          rounded
          text
          :severity="hasPendingChanges ? 'primary' : 'contrast'"
          :disabled="!canEditTable || !hasPendingChanges || isSaving"
          @click="saveChanges"
          aria-label="Save changes"
        />
        <Button
          size="small"
          icon="ti ti-reload"
          class="size-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canQueryTable || !hasPendingChanges"
          @click="discardChanges"
          aria-label="Discard"
        />
        <Button
          size="small"
          @click="() => extendedDataTable?.addRow()"
          icon="ti ti-plus"
          class="h-[1.8rem] w-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canEditTable"
        />
        <Button
          size="small"
          @click="() => extendedDataTable?.deleteSelectedRows()"
          icon="ti ti-trash"
          class="h-[1.8rem] w-[1.8rem]"
          rounded
          text
          severity="contrast"
          :disabled="!canEditTable"
        />
      </div>

      <div class="flex items-center gap-4 text-xs uppercase tracking-[0.16em] opacity-55 mono">
        <span>{{ props.data.sourceName }}</span>
        <span>{{ props.data.tableName }}</span>
        <span>{{ total }} rows</span>
      </div>
    </div>

    <div
      class="border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap px-3 py-0 items-center gap-3"
    >
      <div class="flex items-center gap-2 min-w-0 flex-[1.4]">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Where</span>
        <div
          class="flex-1 min-w-[18rem] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2"
        >
          <SQLEditor
            v-model="whereInput"
            class="w-full"
            placeholder="status = 'paid' AND total > 100"
            :source-type="sourceType"
            :schema="completionSchema"
            :default-schema="completionDefaultSchema"
            :default-table="props.data.tableName"
            @enter="applyWhereClause"
          />
        </div>
        <Button
          icon="ti ti-x"
          size="small"
          text
          severity="secondary"
          :disabled="!canQueryTable || (!whereInput && !appliedWhereClause)"
          @click="clearWhereClause"
        />
      </div>

      <div class="flex items-center gap-2 min-w-0 flex-[1.2]">
        <span class="text-xs uppercase tracking-[0.16em] opacity-55 mono">Sort</span>
        <div
          class="flex-1 min-w-[16rem] rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2"
        >
          <SQLEditor
            v-model="sortInput"
            class="w-full"
            placeholder="created_at DESC, id ASC"
            :source-type="sourceType"
            :schema="completionSchema"
            :default-schema="completionDefaultSchema"
            :default-table="props.data.tableName"
            @enter="applySortClause"
          />
        </div>
        <Button
          icon="ti ti-check"
          size="small"
          text
          severity="secondary"
          :disabled="!canQueryTable"
          @click="applySortClause"
        />
        <Button
          icon="ti ti-rotate-2"
          size="small"
          text
          severity="secondary"
          :disabled="!canQueryTable || !defaultSortClause"
          @click="resetSortClause"
        />
      </div>
    </div>

    <Message v-if="!canQueryTable" severity="warn" class="m-3 mb-0">
      This server account can inspect the schema but cannot load table rows from this datasource.
    </Message>

    <div v-if="isLoading" class="border-b h-full border-neutral-200 dark:border-neutral-800">
      <LoadingContainer />
    </div>

    <div
      v-else
      class="border-b border-neutral-200 dark:border-neutral-800 overflow-hidden h-full min-h-0"
    >
      <div class="h-full min-h-0 flex flex-col">
        <div class="min-h-0 flex-1 overflow-hidden relative">
          <ExtendedDataTable
            ref="extendedDataTable"
            v-model:columns="columns"
            v-model:rows="rows"
            :can-edit="canEditTable"
            class="pb-20"
          />

          <div
            class="flex items-center gap-1 bg-white absolute bottom-6 left-[50%] translate-x-[-50%] border-1 py-0 px-0.5 rounded-xl h-fit border-neutral-200 dark:border-neutral-800"
          >
            <Button
              icon="ti ti-chevron-left"
              size="small"
              text
              severity="secondary"
              :disabled="!canQueryTable || page <= 1"
              @click="changePage(page - 1)"
              rounded
            />
            <Select
              :model-value="pageSize"
              :options="[5, 10, 15, 25, 50, 100, 200, 500, 1000, 2000]"
              size="small"
              class="border-0"
              :disabled="!canQueryTable"
              input-class="px-0 text-xs"
              @update:model-value="(value) => value && changePageSize(value)"
            />
            <span class="text-xs mono opacity-60">Page {{ page }} / {{ pageCount }}</span>
            <Button
              icon="ti ti-chevron-right"
              size="small"
              text
              severity="secondary"
              :disabled="!canQueryTable || page >= pageCount"
              @click="changePage(page + 1)"
              rounded
            />
          </div>
        </div>

        <ResizeKnob
          v-if="activityLogs.length && logsVisible"
          v-model:height="logsHeight"
          direction="vertical"
          :min-height="96"
          :max-height="280"
          class="border-t border-neutral-200 dark:border-neutral-800"
        />

        <CollapsibleActivityPanel
          v-model:expanded="logsVisible"
          :entries="activityLogs"
          empty-message="No table logs yet."
          expanded-class="border-t border-neutral-200 dark:border-neutral-800"
          panel-class="h-full"
          :expanded-style="{ height: `${logsHeight}px` }"
        />
      </div>
    </div>

    <div
      class="border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center justify-between text-xs mono opacity-60"
    >
      <span>
        {{ dirtyRows.filter((row) => row.state === 'new').length }} inserted /
        {{ dirtyRows.filter((row) => row.state === 'modified').length }} updated /
        {{ dirtyRows.filter((row) => row.state === 'deleted').length }} deleted
      </span>
      <span v-if="hasPendingChanges">Unsaved changes on current page</span>
      <span v-else-if="appliedWhereClause">Filtered by: {{ appliedWhereClause }}</span>
      <span v-else-if="appliedSortClause">Sorted by: {{ appliedSortClause }}</span>
      <span v-else>Everything saved</span>
    </div>
  </div>
</template>
