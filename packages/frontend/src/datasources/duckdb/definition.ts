import ConfigForm from '@/datasources/duckdb/ConfigForm.vue'
import { defineDataSourceDefinition } from '@/datasources/shared/module'

export const duckDbDataSourceDefinition = defineDataSourceDefinition({
  type: 'duckdb',
  kind: 'sql',
  label: 'DuckDB',
  icon: 'database',
  localOnly: true,
  capabilities: {
    sqlQuery: true,
    tableBrowser: true,
    dataEditor: true,
    schemaEditor: true,
    tableCreate: true,
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
