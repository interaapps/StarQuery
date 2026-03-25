<script lang="ts" setup>
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import SQLEditor from '@/components/editors/SQLEditor.vue'
import { computed, ref } from 'vue'

const tablename = 'example_records'
const name = ref('')
const type = ref('INT')
const defaultValue = ref('')
const onUpdate = ref('')
const notNull = ref(false)
const hidden = ref(false)
const autoIncrement = ref(false)
const collation = ref('')
const buildOutput = computed(() => {
  const sql = `ALTER TABLE \`${tablename}\`
    ADD COLUMN \`${name.value}\` ${type.value}`

  return sql
})
</script>
<template>
  <div class="grid grid-cols-2 gap-3">
    <div class="flex flex-col gap-4">
      <div class="flex gap-2">
        <div class="flex flex-col gap-2 w-full">
          <label>Name</label>
          <InputText fluid size="small" v-model="name" />
        </div>
        <div class="flex flex-col gap-2 w-full overflow-hidden">
          <label>Type</label>
          <div class="border border-neutral-400 px-1.5 py-1 rounded-md overflow-auto">
            <SQLEditor class="w-full" v-model="type" />
          </div>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <label>Default</label>
        <div class="border border-neutral-400 px-1.5 py-1 rounded-md overflow-auto">
          <SQLEditor class="w-full" placeholder="(NULL)" v-model="defaultValue" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <label>On Update</label>
        <div class="border border-neutral-400 px-1.5 py-1 rounded-md overflow-auto">
          <SQLEditor class="w-full" v-model="onUpdate" />
        </div>
      </div>
      <div class="flex gap-5 items-center">
        <div class="flex gap-2 items-center">
          <Checkbox binary v-model="notNull" />
          <label>Not Null</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox binary v-model="hidden" />
          <label>Hidden</label>
        </div>
        <div class="flex gap-2 items-center">
          <Checkbox binary v-model="autoIncrement" />
          <label>Auto Increment</label>
        </div>
      </div>

      <div class="flex flex-col gap-2 w-full">
        <label>Collation</label>
        <Select fluid size="small" v-model="collation" />
      </div>
    </div>

    <div class="flex flex-col gap-2 w-full h-full overflow-auto relative">
      <label>Output</label>
      <pre class="mono border border-neutral-300 p-3 rounded-md min-h-full text-sm">{{
        buildOutput
      }}</pre>

      <Button label="run" icon="ti ti-player-play" class="absolute bottom-3 right-3" size="small" />
    </div>
  </div>
</template>
