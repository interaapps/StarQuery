<script setup lang="ts">
const props = defineProps<{
  minWidth?: number
  maxWidth?: number
}>()
const width = defineModel<number>('width')

const onMouseDown = (e: MouseEvent) => {
  const originalWidth = width.value
  const startClientX = e.pageX

  const windowMouseMove = (e: MouseEvent) => {
    const newWidth = Math.max(props.minWidth || 0, originalWidth + (e.pageX - startClientX))
    if (!props.maxWidth || width.value < props.maxWidth) {
      width.value = newWidth - 1
    } else {
      width.value = props.maxWidth
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const windowMouseUp = (e) => {
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
    class="w-[0.6rem] h-full bg-transparent cursor-col-resize hover:bg-primary-500/10 transition-all"
  ></div>
</template>
