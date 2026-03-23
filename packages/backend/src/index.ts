import { startBackendServer } from './server'

async function main() {
  const runningServer = await startBackendServer()

  const shutdown = async () => {
    await runningServer.close()
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
