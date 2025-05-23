<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import ResizeKnob from '@/components/ResizeKnob.vue'
import ContextMenu, { type ContextMenuMethods } from 'primevue/contextmenu'

const columns = defineModel<{ name: string; field: string }[]>('columns', { required: true })
const data = defineModel<Record<string, any>[]>('data', { required: true })

const newRows = ref<number[]>([])

const selectedRows = ref<number[]>([])
const selectedColumns = ref<number[]>([])

const lastSelectedRow = ref<number | null>(null)
const lastSelectedColumn = ref<number | null>(null)

const editCurrent = ref(false)

const columnStartEditClick = (
  entryIndex: number = lastSelectedRow.value!,
  columnIndex: number = lastSelectedColumn.value!,
) => {
  if (lastSelectedRow.value === entryIndex && lastSelectedColumn.value === columnIndex) {
    editCurrent.value = true
  }
}

const isBeingEdited = (entryIndex: number, columnIndex: number) =>
  editCurrent.value &&
  lastSelectedColumn.value === columnIndex &&
  lastSelectedRow.value === entryIndex

const columnClick = (e: MouseEvent, rowIndex: number, columnIndex: number) => {
  const cell = e.currentTarget as HTMLTableCellElement
  const cellRect = cell.getBoundingClientRect()

  if (!e.metaKey) {
    selectedRows.value = []
    selectedColumns.value = []
  }

  if (e.shiftKey) {
    if (lastSelectedRow.value !== null && lastSelectedColumn.value !== null) {
      const startRow = Math.min(lastSelectedRow.value, rowIndex)
      const endRow = Math.max(lastSelectedRow.value, rowIndex)
      const startColumn = Math.min(lastSelectedColumn.value, columnIndex)
      const endColumn = Math.max(lastSelectedColumn.value, columnIndex)

      for (let i = startRow; i <= endRow; i++) {
        if (!selectedRows.value.includes(i)) {
          selectedRows.value.push(i)
        }
      }

      for (let j = startColumn; j <= endColumn; j++) {
        if (!selectedColumns.value.includes(j)) {
          selectedColumns.value.push(j)
        }
      }
    }
  } else if (selectedRows.value.includes(rowIndex) && selectedColumns.value.includes(columnIndex)) {
    selectedRows.value.splice(selectedRows.value.indexOf(rowIndex), 1)
    selectedColumns.value.splice(selectedColumns.value.indexOf(columnIndex), 1)
    return
  }

  selectedRows.value.push(rowIndex)
  selectedColumns.value.push(columnIndex)
  lastSelectedColumn.value = columnIndex
  lastSelectedRow.value = rowIndex
  editCurrent.value = false
}

const isDragging = ref(false)

const dragStartRow = ref<number | null>(null)
const dragStartColumn = ref<number | null>(null)

const mousedown = (e: MouseEvent, rowIndex: number, columnIndex: number) => {
  e.preventDefault()
  isDragging.value = true
  dragStartRow.value = rowIndex
  dragStartColumn.value = columnIndex
  console.log('Is dragging', dragStartRow.value, dragStartColumn.value)
  columnClick(e, rowIndex, columnIndex)
}
function getNumbersBetween(start: number, end: number) {
  const step = start <= end ? 1 : -1
  return Array.from({ length: Math.abs(end - start) + 1 }, (_, i) => start + i * step)
}

const mouseup = (e: MouseEvent, rowIndex: number, columnIndex: number) => {
  e.preventDefault()
  if (isDragging.value) {
    getNumbersBetween(rowIndex, dragStartRow.value!).forEach((row) => {
      if (!selectedRows.value.includes(row)) {
        selectedRows.value.push(row)
      }
    })
    getNumbersBetween(columnIndex, dragStartColumn.value!).forEach((column) => {
      if (!selectedColumns.value.includes(column)) {
        selectedColumns.value.push(column)
      }
    })
    isDragging.value = false
  }
}

const mouseenter = (e: MouseEvent, rowIndex: number, columnIndex: number) => {
  /*if (isDragging.value) {
    selectedRows.value.push(rowIndex)
    selectedColumns.value.push(columnIndex)
  } */
}

const deletedRows = ref<number[]>([])

const deleteSelectedRows = () => {
  selectedRows.value.forEach((row) => {
    if (newRows.value.includes(row)) {
      data.value.splice(row, 1)
      newRows.value.splice(newRows.value.indexOf(row), 1)
    } else if (!deletedRows.value.includes(row)) {
      deletedRows.value.push(row)
    }
  })
  selectedRows.value = []
  selectedColumns.value = []
}

const editValues = ref<{ index: number; data: any }[]>([])

const getValue = (rowIndex: number, columnIndex: number) => {
  const editValue = editValues.value.find((e) => e.index === rowIndex)
  if (editValue?.data && columns.value[columnIndex].field in editValue.data) {
    return editValue.data[columns.value[columnIndex].field]
  }
  return data.value[rowIndex][columns.value[columnIndex].field]
}

const setValue = (rowIndex: number, columnIndex: number, value: any) => {
  if (getValue(rowIndex, columnIndex) === value) return
  const editValue = editValues.value.find((e) => e.index === rowIndex)

  if (editValue) {
    editValue.data[columns.value[columnIndex].field] = value
  } else {
    editValues.value.push({
      index: rowIndex,
      data: { [columns.value[columnIndex].field]: value },
    })
  }
}

const widths = ref<Record<string, number>>(
  columns.value.reduce((prev, curr) => ({ ...prev, [curr.field]: 200 }), {}),
)

const addRow = () => {
  const ind =
    data.value.push(columns.value.reduce((prev, curr) => ({ ...prev, [curr.field]: null }), {})) - 1
  newRows.value.push(ind)
  console.log({ ind })
}

defineExpose({
  deleteSelectedRows,
  addRow,
})

const selectAllRows = () => {
  selectedRows.value = Array.from({ length: data.value.length }, (_, i) => i)
}

const selectAllColumns = () => {
  selectedColumns.value = Array.from({ length: columns.value.length }, (_, i) => i)
}

const selectRow = (index: number) => {
  selectedRows.value = [index]
  selectedColumns.value = Array.from({ length: columns.value.length }, (_, i) => i)
}

const selectColumn = (index: number) => {
  selectedColumns.value = [index]
  selectedRows.value = Array.from({ length: data.value.length }, (_, i) => i)
}

const selectAll = () => {
  selectAllRows()
  selectAllColumns()
}

const keyBoardAction = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return

  const shift = event.shiftKey

  if (event.metaKey && event.code === 'KeyA') {
    selectAll()
    event.preventDefault()
  } else if (event.code === 'Enter') {
    columnStartEditClick()
    event.preventDefault()
  } else if (event.code === 'ArrowRight') {
    editCurrent.value = false
    selectedColumns.value = [selectedColumns.value[0] + 1]
  } else if (event.code === 'ArrowLeft') {
    editCurrent.value = false
    selectedColumns.value = [selectedColumns.value[0] - 1]
  } else if (event.code === 'ArrowDown') {
    editCurrent.value = false
    selectedRows.value = [selectedRows.value[0] + 1]
  } else if (event.code === 'ArrowUp') {
    editCurrent.value = false
    selectedRows.value = [selectedRows.value[0] - 1]
  }
}

onMounted(() => {
  window.addEventListener('keydown', keyBoardAction)
})
onUnmounted(() => window.removeEventListener('keydown', keyBoardAction))

const contextMenu = useTemplateRef<ContextMenuMethods>('contextMenu')
</script>
<template>
  <table class="m-[-1px]" style="width: max-content" @contextmenu="(e) => contextMenu?.show(e)">
    <tr class="sticky top-0 left-0 bg-[#F9F9F9] dark:bg-[#323232] z-100">
      <th>
        <button
          class="w-full h-full hover:bg-neutral-500/20 text-sm rounded-md text-transparent select-none"
          @click="selectAll"
        >
          ALL
        </button>
      </th>
      <th
        v-for="(column, columnI) of columns"
        :key="columnI"
        align="left"
        class="border border-neutral-200 p-0.5 px-2 dark:border-neutral-700 font-normal align-left mono text-sm relative border-t-0 select-none"
        :class="{ 'bg-black/5 dark:bg-white/10': selectedColumns.includes(columnI) }"
        :style="{ width: `${widths[column.field] || 200}px` }"
        @click="selectColumn(columnI)"
      >
        <div class="flex items-center gap-1 justify-between">
          <div class="flex items-center gap-1">
            <i class="ti ti-layout-sidebar opacity-50" />
            <span class="opacity-50">{{ column.name }}</span>
          </div>
          <i class="ti ti-selector opacity-50" />
        </div>
        <ResizeKnob
          v-model:width="widths[column.field]"
          class="absolute right-[-0.3rem] top-0 z-10"
        />
      </th>
    </tr>
    <tr
      v-for="(entry, entryIndex) in data"
      :key="entryIndex"
      :class="{
        'bg-neutral-500/5 ': (entryIndex + 1) % 2 === 0,
        'bg-red-700/15': deletedRows.includes(entryIndex),
        'bg-red-700/20': (entryIndex + 1) % 2 === 0 && deletedRows.includes(entryIndex),
        'bg-primary-500/2 dark:bg-primary-500/5': selectedRows.includes(entryIndex),
        'dark:bg-primary-500/10': (entryIndex + 1) % 2 === 0 && selectedRows.includes(entryIndex),
      }"
    >
      <td
        class="border border-neutral-200 p-0.5 px-3 text-center dark:border-neutral-700 mono text-sm sticky left-[-1px] border-l-0 bg-neutral-50 dark:bg-neutral-900 z-10"
        @click="selectRow(entryIndex)"
      >
        <span class="opacity-50 select-none">
          {{ entryIndex + 1 }}
        </span>
      </td>
      <!-- @click="(e) => columnClick(e, entryIndex, columnIndex)"-->
      <td
        v-for="(column, columnIndex) of columns"
        :key="columnIndex"
        class="border border-neutral-200 dark:border-neutral-700 mono text-sm"
        @mousedown="(e) => mousedown(e, entryIndex, columnIndex)"
        @mouseup="(e) => mouseup(e, entryIndex, columnIndex)"
        @mouseenter="(e) => mouseenter(e, entryIndex, columnIndex)"
        @dblclick="
          (e) => {
            isDragging = false
            columnStartEditClick(entryIndex, columnIndex)
          }
        "
        :class="{
          'bg-primary-500/20':
            selectedRows.includes(entryIndex) && selectedColumns.includes(columnIndex),
          'bg-blue-500/40':
            editValues.find((e) => e.index === entryIndex)?.data?.[column.field] !== undefined,
        }"
      >
        <input
          v-if="isBeingEdited(entryIndex, columnIndex)"
          @mousedown.stop
          @mouseenter.stop
          @mouseup.stop
          :key="(e: HTMLInputElement) => e.focus()"
          @focusout="
            (e) => {
              setValue(entryIndex, columnIndex, (e.target as HTMLInputElement).value)
              editCurrent = false
            }
          "
          @keydown.enter="(e) => (editCurrent = false)"
          @keydown.esc.stop="(e) => (editCurrent = false)"
          :value="getValue(entryIndex, columnIndex)"
          class="w-full h-full border border-primary-500 p-0.5 px-2 outline-none"
        />
        <span class="p-0.5 px-2 border border-transparent whitespace-pre select-none" v-else>
          <span v-if="getValue(entryIndex, columnIndex) === null" class="opacity-40">NULL</span>
          <span v-else>
            {{ getValue(entryIndex, columnIndex) }}
          </span>
        </span>
      </td>
    </tr>
  </table>
  <ContextMenu
    ref="contextMenu"
    class="text-sm"
    :pt="{ itemLink: 'p-2 px-3' }"
    :model="[
      { label: 'Edit', icon: 'ti ti-edit' },
      { label: 'Copy', icon: 'ti ti-copy' },
      { label: 'Set NULL', icon: 'ti ti-x' },
      { separator: true },
      { label: 'Delete', icon: 'ti ti-trash', command: deleteSelectedRows },
      { label: 'Select All', icon: 'ti ti-check', command: selectAllRows },
      { label: 'Select Column', icon: 'ti ti-check', command: selectAllColumns },
      { label: 'Add row', icon: 'ti ti-row-insert-bottom', command: addRow },
      { separator: true },
      { label: 'Export', icon: 'ti ti-file-export' },
      { label: 'Import', icon: 'ti ti-file-import' },
    ]"
  />
</template>
