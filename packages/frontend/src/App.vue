<script setup lang="ts">
import Tree from 'primevue/tree'
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import ResizeKnob from '@/components/ResizeKnob.vue'

const nodes = ref([
  {
    key: 'sources/mysql:pastefy',
    label: 'Documents',
    data: { data: 'pastefy' },
    icon: 'ti ti-brand-mysql',
    children: [
      {
        key: 'sources/mysql:pastefy/pastefy_pastes',
        label: 'pastefy_pastes',
        data: 'pastefy_pastes',
        icon: 'ti ti-table',
      },
      {
        key: 'sources/mysql:pastefy/pastefy_users',
        label: 'pastefy_users',
        data: 'pastefy_users',
        icon: 'ti ti-table',
      },
      {
        key: 'sources/mysql:pastefy/pastefy_folders',
        label: 'pastefy_folders',
        data: 'pastefy_folders',
        icon: 'ti ti-table',
      },
    ],
  },
])

const expandNode = (node: any) => {
  if (node.children && node.children.length) {
    expandedKeys.value[node.key] = true

    for (let child of node.children) {
      expandNode(child)
    }
  }
}

const expandAll = () => {
  for (let node of nodes.value) {
    expandNode(node)
  }

  expandedKeys.value = { ...expandedKeys.value }
}
const selectedKey = ref(undefined)
const expandedKeys = ref<Record<string, boolean>>({})
onMounted(() => expandAll())

const sideBarWidth = ref(300)
</script>

<template>
  <div
    class="grid h-full"
    :style="{
      gridTemplateColumns: `68px ${sideBarWidth}px 1fr`,
    }"
  >
    <div class="p-2 border-r border-neutral-200 dark:border-neutral-800">
      <div class="flex flex-col gap-3 justify-between h-full">
        <div class="flex flex-col gap-3 electron:pt-4">
          <router-link to="/" class="hover:scale-110 active:scale-95 transition-all">
            <img
              src="@/assets/logo.svg"
              class="w-full animate-[spin_120s_linear_infinite] select-none hover:animate-duration-2000 active:animate-duration-1000"
            />
          </router-link>

          <div class="flex flex-col gap-2 p-1.5 pt-0">
            <!--<router-link
              to="/"
              class="w-full aspect-square flex justify-center items-center bg-primary-500/20 rounded-lg"
            >
              <i class="text-primary-500 text-xl ti ti-device-laptop" />
            </router-link> -->
            <router-link
              to="/"
              class="w-full aspect-square flex justify-center items-center bg-primary-500/20 rounded-lg"
            >
              <span class="text-primary-500/80 font-bold">I</span>
            </router-link>
            <router-link
              to="/"
              class="w-full aspect-square flex justify-center items-center bg-neutral-500/5 rounded-full"
            >
              <span class="text-neutral-500/80 font-bold">I</span>
            </router-link>
          </div>
        </div>
        <div class="p-1">
          <router-link
            to="/"
            class="w-full aspect-square flex justify-center items-center border border-primary-500/20 rounded-full"
          >
            <span class="text-primary-500 text-lg font-bold select-none">U</span>
          </router-link>
        </div>
      </div>
    </div>
    <div class="border-r border-neutral-200 dark:border-neutral-800 px-0.5 relative">
      <div class="flex w-full justify-between items-center p-2 pb-0 pt-0.5 pr-0 region-drag">
        <span class="opacity-60">sources</span>
        <Button
          icon="ti ti-plus text-lg p-0.5"
          size="small"
          rounded
          severity="contrast"
          text
          class="region-no-drag"
        />
      </div>
      <Tree
        v-model:selectionKeys="selectedKey"
        v-model:expandedKeys="expandedKeys"
        size="small"
        :value="nodes"
        selectionMode="single"
        class="w-full bg-transparent p-0 text-sm"
      />

      <ResizeKnob
        :min-width="230"
        :max-width="460"
        v-model:width="sideBarWidth"
        class="absolute right-[-0.3rem] top-0"
      />
    </div>
    <main class="h-full w-full overflow-hidden">
      <RouterView />
    </main>
  </div>
</template>
