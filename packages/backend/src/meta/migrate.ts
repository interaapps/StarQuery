import { loadAppConfig } from '../config/app-config.ts'
import { MetaStore } from './store.ts'

async function main() {
  const store = new MetaStore(loadAppConfig())
  await store.initialize()
  await store.close()
  console.log('Meta migrations applied')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
