import { computed, nextTick, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'
import type { SQLTableColumn, SQLTableRowDraft } from '@/types/sql'
import type { CellPosition, RenderedTableRow } from '@/components/table/extended-data-table.types'
import {
  VIRTUALIZATION_ROW_THRESHOLD,
  VIRTUAL_OVERSCAN_ROWS,
  VIRTUAL_ROW_HEIGHT,
} from '@/components/table/extended-data-table-utils'

type ViewportElementRef<T> = Ref<T | null | undefined>

export function useExtendedDataTableViewport(options: {
  gridContainer: ViewportElementRef<HTMLDivElement>
  tableHead: ViewportElementRef<HTMLTableSectionElement>
  cornerHeaderCell: ViewportElementRef<HTMLTableCellElement>
  rows: Ref<SQLTableRowDraft[]>
  columns: Ref<SQLTableColumn[]>
  widths: Ref<Record<string, number>>
  editingCell: Ref<CellPosition | null>
  clampCell: (cell: CellPosition) => CellPosition
  hasRows: Ref<boolean>
}) {
  const containerScrollTop = ref(0)
  const containerHeight = ref(0)
  const tableHeadHeight = ref(0)
  const stickyColumnWidth = ref(48)
  const measuredRowHeight = ref(VIRTUAL_ROW_HEIGHT)

  let viewportSyncFrame = 0
  let resizeObserver: ResizeObserver | null = null

  const shouldVirtualizeRows = computed(
    () => options.rows.value.length >= VIRTUALIZATION_ROW_THRESHOLD,
  )

  const bodyViewportHeight = computed(() =>
    Math.max(containerHeight.value - tableHeadHeight.value, measuredRowHeight.value),
  )

  const visibleRowRange = computed(() => {
    if (!options.rows.value.length) {
      return {
        start: 0,
        end: -1,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      }
    }

    if (!shouldVirtualizeRows.value) {
      return {
        start: 0,
        end: options.rows.value.length - 1,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      }
    }

    const bodyScrollTop = Math.max(containerScrollTop.value - tableHeadHeight.value, 0)
    const firstVisibleRow = Math.floor(bodyScrollTop / measuredRowHeight.value)
    const visibleRowCount = Math.max(
      1,
      Math.ceil(bodyViewportHeight.value / measuredRowHeight.value),
    )
    const start = Math.max(0, firstVisibleRow - VIRTUAL_OVERSCAN_ROWS)
    const end = Math.min(
      options.rows.value.length - 1,
      firstVisibleRow + visibleRowCount + VIRTUAL_OVERSCAN_ROWS,
    )

    return {
      start,
      end,
      topSpacerHeight: start * measuredRowHeight.value,
      bottomSpacerHeight: Math.max(
        0,
        (options.rows.value.length - end - 1) * measuredRowHeight.value,
      ),
    }
  })

  const renderedRows = computed<RenderedTableRow<SQLTableRowDraft>[]>(() => {
    const { start, end } = visibleRowRange.value
    if (end < start) {
      return []
    }

    return options.rows.value.slice(start, end + 1).map((row, index) => ({
      row,
      rowIndex: start + index,
    }))
  })

  const syncViewportMetrics = () => {
    viewportSyncFrame = 0
    containerScrollTop.value = options.gridContainer.value?.scrollTop ?? 0
    containerHeight.value = options.gridContainer.value?.clientHeight ?? 0
    tableHeadHeight.value = options.tableHead.value?.offsetHeight ?? 0
    stickyColumnWidth.value = options.cornerHeaderCell.value?.offsetWidth ?? 48

    const measuredDataRow = options.gridContainer.value?.querySelector<HTMLTableRowElement>(
      'tbody tr[data-virtual-row="true"]:not([data-is-editing-row="true"])',
    )
    if (measuredDataRow?.offsetHeight) {
      measuredRowHeight.value = measuredDataRow.offsetHeight
    }
  }

  const scheduleViewportSync = () => {
    if (viewportSyncFrame) {
      return
    }

    viewportSyncFrame = requestAnimationFrame(syncViewportMetrics)
  }

  const getCellElement = (cell: CellPosition) =>
    options.gridContainer.value?.querySelector<HTMLTableCellElement>(
      `td[data-cell-row="${cell.row}"][data-cell-column="${cell.column}"]`,
    ) ?? null

  const ensureCellVisible = (cell: CellPosition) => {
    const container = options.gridContainer.value
    if (!container) {
      return
    }

    if (shouldVirtualizeRows.value) {
      const rowTop = tableHeadHeight.value + cell.row * measuredRowHeight.value
      const rowBottom = rowTop + measuredRowHeight.value
      const viewportTop = container.scrollTop + tableHeadHeight.value
      const viewportBottom = container.scrollTop + container.clientHeight

      if (rowTop < viewportTop) {
        container.scrollTop = Math.max(0, rowTop - tableHeadHeight.value)
        syncViewportMetrics()
      } else if (rowBottom > viewportBottom) {
        container.scrollTop = Math.max(0, rowBottom - container.clientHeight)
        syncViewportMetrics()
      }
    }

    nextTick(() => {
      getCellElement(cell)?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    })
  }

  const getColumnIndexFromPointer = (clientX: number) => {
    const container = options.gridContainer.value
    if (!container || !options.columns.value.length) {
      return 0
    }

    const containerRect = container.getBoundingClientRect()
    const contentX = Math.max(
      0,
      clientX - containerRect.left + container.scrollLeft - stickyColumnWidth.value,
    )

    let consumedWidth = 0
    for (let columnIndex = 0; columnIndex < options.columns.value.length; columnIndex += 1) {
      consumedWidth += options.widths.value[options.columns.value[columnIndex].field] ?? 220
      if (contentX < consumedWidth) {
        return columnIndex
      }
    }

    return options.columns.value.length - 1
  }

  const getCellPositionFromPointer = (clientX: number, clientY: number) => {
    const container = options.gridContainer.value
    if (!container || !options.hasRows.value) {
      return null
    }

    const containerRect = container.getBoundingClientRect()
    const probeX = Math.min(Math.max(clientX, containerRect.left + 2), containerRect.right - 2)
    const probeY = Math.min(Math.max(clientY, containerRect.top + 2), containerRect.bottom - 2)
    const element = document.elementFromPoint(probeX, probeY)
    const cell = element?.closest?.(
      'td[data-cell-row][data-cell-column]',
    ) as HTMLTableCellElement | null

    if (cell) {
      const row = Number(cell.dataset.cellRow)
      const column = Number(cell.dataset.cellColumn)

      if (!Number.isNaN(row) && !Number.isNaN(column)) {
        return options.clampCell({ row, column })
      }
    }

    if (!shouldVirtualizeRows.value) {
      return null
    }

    const relativeY = clientY - containerRect.top + container.scrollTop - tableHeadHeight.value
    const row = Math.floor(relativeY / measuredRowHeight.value)
    const column = getColumnIndexFromPointer(clientX)

    return options.clampCell({ row, column })
  }

  onMounted(() => {
    scheduleViewportSync()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    resizeObserver = new ResizeObserver(() => {
      scheduleViewportSync()
    })

    if (options.gridContainer.value) {
      resizeObserver.observe(options.gridContainer.value)
    }

    if (options.tableHead.value) {
      resizeObserver.observe(options.tableHead.value)
    }
  })

  onUnmounted(() => {
    if (viewportSyncFrame) {
      cancelAnimationFrame(viewportSyncFrame)
    }

    resizeObserver?.disconnect()
  })

  watch(
    [() => options.rows.value.length, () => options.columns.value.length, () => options.editingCell.value],
    () => {
      scheduleViewportSync()
    },
  )

  return {
    shouldVirtualizeRows,
    visibleRowRange,
    renderedRows,
    measuredRowHeight,
    scheduleViewportSync,
    ensureCellVisible,
    getCellPositionFromPointer,
  }
}
