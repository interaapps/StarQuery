<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MenuItem } from 'primevue/menuitem'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import MongoDbCreateCollectionDialog from '@/components/datasources/mongodb/MongoDbCreateCollectionDialog.vue'
import {
  createMongoDbCollection,
  deleteMongoDbCollection,
  parseMongoPath,
} from '@/datasources/mongodb/browser'
import { getErrorMessage } from '@/services/error-message'
import { useTabsStore } from '@/stores/tabs-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import type { DataSourceResourceItem } from '@/types/datasources'
import { isResourceBrowserTab } from '@/types/tabs'
import type { DataSourceRecord } from '@/types/workspace'

const props = defineProps<{
  source: DataSourceRecord
  defaultBrowserPath: string
  expanded: boolean
  canWriteSource: boolean
  openBrowser: (path?: string) => void | Promise<void>
  refreshResources: () => void | Promise<void>
}>()

const workspaceStore = useWorkspaceStore()
const tabsStore = useTabsStore()
const confirm = useConfirm()
const toast = useToast()

const createCollectionVisible = ref(false)
const createCollectionDatabase = ref('')

const defaultMongoDatabase = computed(() => parseMongoPath(props.defaultBrowserPath).database)

function showMongoCreateCollectionDialog(database: string) {
  if (!database || !props.canWriteSource) {
    return
  }

  createCollectionDatabase.value = database
  createCollectionVisible.value = true
}

async function createMongoCollection(collectionName: string) {
  if (!props.canWriteSource || !workspaceStore.currentProjectId || !createCollectionDatabase.value) {
    return
  }

  try {
    const client = await workspaceStore.getClient()
    await createMongoDbCollection({
      client,
      projectId: workspaceStore.currentProjectId,
      sourceId: props.source.id,
      database: createCollectionDatabase.value,
      collection: collectionName,
    })

    createCollectionVisible.value = false

    if (props.expanded) {
      await props.refreshResources()
    }

    toast.add({
      severity: 'success',
      summary: 'Collection created',
      detail: `${collectionName} is now available in ${createCollectionDatabase.value}`,
      life: 2200,
    })

    await props.openBrowser(`${createCollectionDatabase.value}/${collectionName}`)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Collection create failed',
      detail: getErrorMessage(error, 'The MongoDB collection could not be created'),
      life: 3200,
    })
  }
}

async function deleteMongoCollection(item: DataSourceResourceItem) {
  if (!props.canWriteSource || !workspaceStore.currentProjectId) {
    return
  }

  const parsed = parseMongoPath(item.path)
  if (!parsed.database || !parsed.collection) {
    return
  }

  confirm.require({
    header: 'Delete Collection',
    message: `Delete collection ${parsed.collection}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const client = await workspaceStore.getClient()
        await deleteMongoDbCollection({
          client,
          projectId: workspaceStore.currentProjectId!,
          sourceId: props.source.id,
          database: parsed.database,
          collection: parsed.collection,
        })

        tabsStore.closeTabsMatching(
          (tab) =>
            isResourceBrowserTab(tab) &&
            tab.data.sourceType === 'mongodb' &&
            tab.data.sourceId === props.source.id &&
            Boolean(tab.data.path === item.path || tab.data.path?.startsWith(`${item.path}/_doc/`)),
        )

        if (props.expanded) {
          await props.refreshResources()
        }

        toast.add({
          severity: 'success',
          summary: 'Collection deleted',
          detail: `${parsed.collection} has been removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Collection delete failed',
          detail: getErrorMessage(error, 'The MongoDB collection could not be deleted'),
          life: 3200,
        })
      }
    },
  })
}

function getSourceMenuItems(): MenuItem[] {
  if (!defaultMongoDatabase.value) {
    return []
  }

  return [
    {
      label: 'Add collection',
      icon: 'ti ti-plus',
      command: () => showMongoCreateCollectionDialog(defaultMongoDatabase.value),
      disabled: !props.canWriteSource,
    },
  ]
}

function getItemMenuItems(item: DataSourceResourceItem): MenuItem[] {
  if (item.kind !== 'container') {
    return []
  }

  const target = parseMongoPath(item.path)

  if (target.database && !target.collection) {
    return [
      {
        label: 'Add collection',
        icon: 'ti ti-plus',
        command: () => showMongoCreateCollectionDialog(target.database),
        disabled: !props.canWriteSource,
      },
    ]
  }

  if (target.collection) {
    return [
      { separator: true },
      {
        label: 'Delete collection',
        icon: 'ti ti-trash',
        command: () => deleteMongoCollection(item),
        disabled: !props.canWriteSource,
      },
    ]
  }

  return []
}

defineExpose({
  getSourceMenuItems,
  getItemMenuItems,
})
</script>

<template>
  <MongoDbCreateCollectionDialog
    v-model:visible="createCollectionVisible"
    :database="createCollectionDatabase"
    @create="createMongoCollection"
  />
</template>
