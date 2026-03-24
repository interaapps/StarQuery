<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import ContextMenu from 'primevue/contextmenu'
import Popover from 'primevue/popover'
import Toast from 'primevue/toast'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useRoute, useRouter } from 'vue-router'
import SourcesSidebar from '@/components/SourcesSidebar.vue'
import { getErrorMessage } from '@/services/error-message'
import { adminPermissionTargets, projectPermissionTargets } from '@/services/permissions'
import { useAuthStore } from '@/stores/auth-store.ts'
import { useWorkspaceStore } from '@/stores/workspace-store.ts'
import AddServerDialog from '@/components/workspace/AddServerDialog.vue'
import CreateProjectDialog from '@/components/workspace/CreateProjectDialog.vue'
import ManageProjectUsersDialog from '@/components/workspace/ManageProjectUsersDialog.vue'
import type { ProjectRecord, ServerProfile } from '@/types/workspace'

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const toast = useToast()
const confirm = useConfirm()
const router = useRouter()
const route = useRoute()

const sideBarWidth = ref(320)
const addServerVisible = ref(false)
const createProjectVisible = ref(false)
const manageProjectUsersVisible = ref(false)
const serverPopover = ref()
const projectMenu = ref()
const editingServer = ref<ServerProfile | null>(null)
const editingProject = ref<ProjectRecord | null>(null)
const selectedProject = ref<ProjectRecord | null>(null)

const canCreateProject = computed(() =>
  authStore.hasPermission([
    'project.create:write',
    'project.create.*:write',
    'project.manage:write',
    'project.manage.*:write',
    '*',
  ]),
)
const canManageSelectedProject = computed(() =>
  selectedProject.value
    ? authStore.hasPermission(projectPermissionTargets(selectedProject.value.id, 'manage', 'write'))
    : false,
)
const canManageSelectedProjectUsers = computed(() =>
  selectedProject.value
    ? authStore.hasPermission([
        ...projectPermissionTargets(selectedProject.value.id, 'users', 'write'),
        ...projectPermissionTargets(selectedProject.value.id, 'manage', 'write'),
        ...adminPermissionTargets('users', 'write'),
      ])
    : false,
)
const projectMenuItems = computed(() => [
  {
    label: 'Edit workspace',
    icon: 'ti ti-edit',
    command: openEditProjectDialog,
    disabled: !canManageSelectedProject.value,
  },
  {
    label: 'Manage users',
    icon: 'ti ti-users',
    command: openManageProjectUsersDialog,
    disabled: !canManageSelectedProjectUsers.value,
  },
  {
    label: 'Remove workspace',
    icon: 'ti ti-trash',
    command: removeProject,
    disabled: !canManageSelectedProject.value,
  },
])

const syncRouteWithAuth = async () => {
  if (!workspaceStore.hydrated) return

  if (authStore.requiresOnboarding) {
    if (route.name !== 'onboarding') {
      await router.replace({ name: 'onboarding' })
    }
    return
  }

  if (authStore.requiresLogin) {
    if (route.name !== 'login') {
      await router.replace({ name: 'login' })
    }
    return
  }

  if (route.name === 'login' || route.name === 'onboarding') {
    await router.replace({ name: 'home' })
    return
  }

  if (
    route.name === 'admin' &&
    !authStore.hasPermission(adminPermissionTargets('access', 'read'))
  ) {
    await router.replace({ name: 'home' })
  }
}

const syncCurrentServerAuth = async () => {
  try {
    await authStore.refreshStatus()
  } catch (error) {
    if (!workspaceStore.serverError) {
      toast.add({
        severity: 'error',
        summary: 'Server unavailable',
        detail: getErrorMessage(error, 'The selected server is unreachable right now.'),
        life: 3200,
      })
    }
  }

  await workspaceStore.loadWorkspaceFromServer()
  await syncRouteWithAuth()
}

onMounted(async () => {
  await workspaceStore.hydrate()

  try {
    await authStore.consumeCallback()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Login failed',
      detail: getErrorMessage(error, 'The authentication callback could not be completed.'),
      life: 3200,
    })
  }

  await syncCurrentServerAuth()
})

watch(
  () => workspaceStore.currentServerId,
  async (nextServerId, previousServerId) => {
    if (!workspaceStore.hydrated || nextServerId === previousServerId) {
      return
    }

    if (previousServerId && route.name !== 'home') {
      await router.replace({ name: 'home' })
    }

    await syncCurrentServerAuth()
  },
)

watch(
  () => [
    authStore.status.enabled,
    authStore.requiresLogin,
    authStore.requiresOnboarding,
    authStore.currentUser?.id,
    route.name,
  ],
  async () => {
    await syncRouteWithAuth()
  },
)

const saveServer = async (payload: { name: string; url: string; kind: 'local' | 'remote' }) => {
  const wasEditing = Boolean(editingServer.value)

  try {
    if (editingServer.value) {
      await workspaceStore.updateServer(editingServer.value.id, payload)
    } else {
      await workspaceStore.addServer(payload)
    }

    addServerVisible.value = false
    editingServer.value = null

    toast.add({
      severity: 'success',
      summary: wasEditing ? 'Server updated' : 'Server added',
      detail: `${payload.name} is available`,
      life: 2000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: wasEditing ? 'Server update failed' : 'Server unavailable',
      detail: getErrorMessage(error, 'The server could not be saved'),
      life: 3200,
    })
  }
}

const saveProject = async (payload: { name: string; slug?: string; description?: string }) => {
  const wasEditing = Boolean(editingProject.value)

  try {
    if (editingProject.value) {
      await workspaceStore.updateProject(editingProject.value.id, payload)
    } else {
      await workspaceStore.createProject(payload)
    }

    createProjectVisible.value = false
    editingProject.value = null

    toast.add({
      severity: 'success',
      summary: wasEditing ? 'Workspace updated' : 'Workspace created',
      detail: `${payload.name} is ready`,
      life: 2000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: wasEditing ? 'Workspace update failed' : 'Workspace creation failed',
      detail: getErrorMessage(error, 'The workspace could not be saved'),
      life: 3200,
    })
  }
}

const selectProject = async (projectId: string) => {
  await workspaceStore.setCurrentProject(projectId)
}

const getServerIcon = (kind?: 'local' | 'remote') =>
  kind === 'local' ? 'ti-device-laptop' : 'ti-server-2'
const isManagedLocalServer = (server: ServerProfile) => workspaceStore.isBuiltInLocalServer(server)

const serverTooltip = () =>
  workspaceStore.isServerSelectionLocked
    ? `${workspaceStore.currentServer?.name || 'Server'} (locked by frontend config)`
    : workspaceStore.currentServer?.name || 'Select server'

const toggleServerPopover = (event: Event) => {
  if (workspaceStore.isServerSelectionLocked) {
    return
  }

  serverPopover.value?.toggle(event)
}

const selectServer = async (serverId: string) => {
  await workspaceStore.setCurrentServer(serverId)
  serverPopover.value?.hide()
}

const openAddServerDialog = () => {
  serverPopover.value?.hide()
  editingServer.value = null
  addServerVisible.value = true
}

const openEditServerDialog = (server: ServerProfile) => {
  serverPopover.value?.hide()
  editingServer.value = { ...server }
  addServerVisible.value = true
}

const removeServer = (server: ServerProfile) => {
  serverPopover.value?.hide()

  confirm.require({
    header: 'Remove Server',
    message: `Remove server ${server.name}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await workspaceStore.removeServer(server.id)
        toast.add({
          severity: 'success',
          summary: 'Server removed',
          detail: `${server.name} was removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Server removal failed',
          detail: getErrorMessage(error, 'The server could not be removed'),
          life: 3200,
        })
      }
    },
  })
}

const showProjectMenu = (event: MouseEvent, project: ProjectRecord) => {
  selectedProject.value = project
  projectMenu.value?.show(event)
}

const openCreateProjectDialog = () => {
  if (!canCreateProject.value) {
    return
  }

  editingProject.value = null
  createProjectVisible.value = true
}

const openEditProjectDialog = () => {
  if (!selectedProject.value || !canManageSelectedProject.value) return
  editingProject.value = { ...selectedProject.value }
  createProjectVisible.value = true
}

const removeProject = () => {
  if (!selectedProject.value || !canManageSelectedProject.value) return

  const project = selectedProject.value
  confirm.require({
    header: 'Remove Workspace',
    message: `Remove workspace ${project.name}?`,
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await workspaceStore.deleteProject(project.id)
        toast.add({
          severity: 'success',
          summary: 'Workspace removed',
          detail: `${project.name} was removed`,
          life: 2200,
        })
      } catch (error) {
        toast.add({
          severity: 'error',
          summary: 'Workspace removal failed',
          detail: getErrorMessage(error, 'The workspace could not be removed'),
          life: 3200,
        })
      }
    },
  })
}

const openManageProjectUsersDialog = () => {
  if (!selectedProject.value || !canManageSelectedProjectUsers.value) {
    return
  }

  manageProjectUsersVisible.value = true
}
</script>

<template>
  <Toast />
  <ConfirmDialog />

  <div
    class="grid h-full"
    :style="{
      gridTemplateColumns: `76px ${route.meta?.hideSidebar ? '' : `${sideBarWidth}px`} 1fr`,
    }"
  >
    <div class="p-2 border-r app-border app-left-rail min-h-0 sidenav-elements">
      <div class="flex flex-col gap-4 justify-between h-full min-h-0">
        <div class="flex flex-col gap-2 min-h-0 flex-1">
          <router-link to="/" class="hover:scale-110 active:scale-95 transition-all app-logo-link">
            <img
              src="@/assets/logo.svg"
              class="w-full animate-[spin_120s_linear_infinite] select-none hover:animate-duration-2000 active:animate-duration-1000"
            />
          </router-link>

          <div class="flex min-h-0 flex-1 flex-col gap-2 p-1.5 pt-0">
            <div
              class="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto scrollbar-hidden"
            >
              <button
                v-for="project of workspaceStore.projects"
                :key="project.id"
                v-tooltip.right="project.name"
                class="w-full aspect-square shrink-0 flex justify-center items-center rounded-xl transition-all border font-semibold"
                :class="
                  workspaceStore.currentProjectId === project.id
                    ? 'border-primary-500/30 bg-primary-500/20 text-primary-500'
                    : 'border-transparent bg-neutral-500/5 text-neutral-500/80'
                "
                @click="selectProject(project.id)"
                @contextmenu.prevent="showProjectMenu($event, project)"
              >
                <span>{{ project.name.slice(0, 2).toUpperCase() }}</span>
              </button>

              <Button
                v-tooltip.right="'Create workspace'"
                icon="ti ti-plus"
                rounded
                class="border-dashed app-border"
                outlined
                size="large"
                severity="secondary"
                :disabled="
                  !workspaceStore.hydrated ||
                  !workspaceStore.currentServer ||
                  !!workspaceStore.serverError ||
                  !canCreateProject
                "
                @click="openCreateProjectDialog"
              />
            </div>
          </div>
        </div>

        <div class="p-1 mx-auto flex flex-col items-center gap-2">
          <Button
            v-tooltip.right="serverTooltip()"
            :icon="`ti ${getServerIcon(workspaceStore.currentServer?.kind)}`"
            severity="secondary"
            rounded
            text
            size="large"
            outlined
            class="app-border"
            :disabled="workspaceStore.isServerSelectionLocked"
            @click="toggleServerPopover"
          />

          <Popover v-if="!workspaceStore.isServerSelectionLocked" ref="serverPopover">
            <div class="w-[19rem] flex flex-col gap-2">
              <div class="text-xs uppercase tracking-[0.16em] opacity-55 mono px-1 pt-1">
                Servers
              </div>

              <div class="max-h-[22rem] overflow-y-auto scrollbar-hidden pr-1">
                <button
                  v-for="server of workspaceStore.servers"
                  :key="server.id"
                  class="w-full flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors"
                  :class="
                    workspaceStore.currentServerId === server.id
                      ? 'bg-primary-500/15 text-primary-500'
                      : 'bg-neutral-500/5 hover:bg-neutral-500/10'
                  "
                  @click="selectServer(server.id)"
                >
                  <i :class="`ti ${getServerIcon(server.kind)}`" />
                  <span class="truncate flex-1 text-sm">{{ server.name }}</span>
                  <div class="flex items-center gap-1">
                    <i
                      v-if="workspaceStore.currentServerId === server.id"
                      class="ti ti-check text-sm"
                    />
                    <Button
                      size="small"
                      icon="ti ti-edit"
                      text
                      rounded
                      severity="secondary"
                      class="size-[1.6rem]"
                      :disabled="isManagedLocalServer(server)"
                      @click.stop="openEditServerDialog(server)"
                    />
                    <Button
                      size="small"
                      icon="ti ti-trash"
                      text
                      rounded
                      severity="secondary"
                      class="size-[1.6rem]"
                      :disabled="
                        workspaceStore.servers.length === 1 || isManagedLocalServer(server)
                      "
                      @click.stop="removeServer(server)"
                    />
                  </div>
                </button>
              </div>

              <div class="h-px app-border-bg my-1" />

              <Button
                label="Add server"
                icon="ti ti-plus"
                severity="secondary"
                text
                class="justify-start"
                size="small"
                @click="openAddServerDialog"
              />
            </div>
          </Popover>

          <ContextMenu ref="projectMenu" :model="projectMenuItems" />
        </div>
      </div>
    </div>

    <SourcesSidebar v-if="!route.meta?.hideSidebar" v-model:sidebar-width="sideBarWidth" />

    <main class="h-full w-full overflow-hidden">
      <RouterView />
    </main>
  </div>

  <AddServerDialog
    v-model:visible="addServerVisible"
    :mode="editingServer ? 'edit' : 'create'"
    :initial-value="editingServer"
    @submit="saveServer"
  />
  <CreateProjectDialog
    v-model:visible="createProjectVisible"
    :mode="editingProject ? 'edit' : 'create'"
    :initial-value="editingProject"
    @submit="saveProject"
  />
  <ManageProjectUsersDialog
    v-model:visible="manageProjectUsersVisible"
    :project="selectedProject"
  />
</template>
