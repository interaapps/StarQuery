import ConfigForm from '@/datasources/sqlite/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const sqliteDataSourceDefinition = defineDataSourceDefinition({
  type: 'sqlite',
  kind: 'sql',
  label: 'SQLite',
  icon: 'database',
  localOnly: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    schemaEditor: true,
    resourceBrowser: false,
  },
  formComponent: ConfigForm,
  secretFields: [],
  createDefaultConfig() {
    return {
      filePath: '',
    }
  },
  canSubmit(input) {
    return Boolean(input.name.trim() && String(input.config.filePath ?? '').trim())
  },
})
