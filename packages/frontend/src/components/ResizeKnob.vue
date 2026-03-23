<script setup lang="ts">
const props = defineProps<{
  minWidth?: number
  maxWidth?: number
  minHeight?: number
  maxHeight?: number
  direction?: 'horizontal' | 'vertical'
}>()
const width = defineModel<number>('width')
const height = defineModel<number>('height')

const clamp = (value: number, minimum: number, maximum?: number) => {
  if (typeof maximum === 'number') {
    return Math.min(Math.max(value, minimum), maximum)
  }

  return Math.max(value, minimum)
}

const onMouseDown = (e: MouseEvent) => {
  e.preventDefault()

  const isVertical = props.direction === 'vertical'
  const originalSize = isVertical ? (height.value ?? props.minHeight ?? 0) : (width.value ?? props.minWidth ?? 0)
  const startClientPosition = isVertical ? e.clientY : e.clientX

  const windowMouseMove = (e: MouseEvent) => {
    const nextPosition = isVertical ? e.clientY : e.clientX
    const nextSize = originalSize + (nextPosition - startClientPosition)

    if (isVertical) {
      height.value = clamp(nextSize, props.minHeight ?? 0, props.maxHeight)
    } else {
      width.value = clamp(nextSize, props.minWidth ?? 0, props.maxWidth)
    }

    e.preventDefault()
    e.stopPropagation()
  }

  const windowMouseUp = (_event: MouseEvent) => {
    window.removeEventListener('mousemove', windowMouseMove)
    window.removeEventListener('mouseup', windowMouseUp)
  }
  window.addEventListener('mousemove', windowMouseMove)
  window.addEventListener('mouseup', windowMouseUp)
}
</script>
<template>
  <div
    @mousedown="onMouseDown"
    :class="
      direction === 'vertical'
        ? 'w-full h-[0.6rem] bg-transparent cursor-row-resize hover:bg-primary-500/10 transition-all'
        : 'w-[0.6rem] h-full bg-transparent cursor-col-resize hover:bg-primary-500/10 transition-all'
    "
  ></div>
</template>
