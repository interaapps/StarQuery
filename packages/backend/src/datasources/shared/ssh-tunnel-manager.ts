import { createRequire } from 'node:module'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import type { SshTunnelConfig } from './transport.ts'

type SshClient = {
  on(event: string, listener: (...args: any[]) => void): SshClient
  once(event: string, listener: (...args: any[]) => void): SshClient
  connect(options: Record<string, unknown>): SshClient
  end(): void
  destroy(): void
  forwardOut(
    srcIP: string,
    srcPort: number,
    dstIP: string,
    dstPort: number,
    callback: (error?: Error | null, stream?: net.Socket) => void,
  ): void
}

type TunnelEntry = {
  key: string
  ready: Promise<void>
  client?: SshClient
  server?: net.Server
  localPort?: number
  refCount: number
  closeTimer?: NodeJS.Timeout
  closed: boolean
}

const DEFAULT_IDLE_TTL_MS = 30_000

function normalizeFingerprint(input: string) {
  return input.trim().replace(/^SHA256:/i, '')
}

export class SshTunnelManager {
  private static readonly require = createRequire(import.meta.url)
  private readonly entries = new Map<string, TunnelEntry>()
  private readonly idleTtlMs: number

  constructor(options?: { idleTtlMs?: number }) {
    this.idleTtlMs = options?.idleTtlMs ?? DEFAULT_IDLE_TTL_MS
  }

  async acquireTunnel(input: {
    ssh: SshTunnelConfig
    targetHost: string
    targetPort: number
  }) {
    const remoteHost = input.ssh.remoteHost?.trim() || input.targetHost
    const remotePort = input.ssh.remotePort ?? input.targetPort
    const key = JSON.stringify({
      sshHost: input.ssh.host,
      sshPort: input.ssh.port,
      username: input.ssh.username,
      authMethod: input.ssh.authMethod,
      password: input.ssh.password,
      privateKey: input.ssh.privateKey,
      passphrase: input.ssh.passphrase,
      hostKeyFingerprint: input.ssh.hostKeyFingerprint,
      remoteHost,
      remotePort,
    })

    let entry = this.entries.get(key)
    if (!entry) {
      entry = {
        key,
        ready: Promise.resolve(),
        refCount: 0,
        closed: false,
      }
      entry.ready = this.createTunnel(entry, input.ssh, remoteHost, remotePort).catch((error) => {
        this.entries.delete(key)
        entry!.closed = true
        throw error
      })
      this.entries.set(key, entry)
    }

    clearTimeout(entry.closeTimer)
    await entry.ready
    entry.refCount += 1

    return {
      host: '127.0.0.1',
      port: entry.localPort!,
      release: async () => {
        if (entry?.closed) {
          return
        }

        entry.refCount = Math.max(0, entry.refCount - 1)
        if (entry.refCount > 0 || entry.closed) {
          return
        }

        entry.closeTimer = setTimeout(() => {
          void this.closeEntry(entry!)
        }, this.idleTtlMs)
      },
    }
  }

  async closeAll() {
    await Promise.all([...this.entries.values()].map((entry) => this.closeEntry(entry)))
  }

  private async createTunnel(
    entry: TunnelEntry,
    ssh: SshTunnelConfig,
    remoteHost: string,
    remotePort: number,
  ) {
    const { Client } = SshTunnelManager.require('ssh2') as { Client: new () => SshClient }
    const client = new Client()
    entry.client = client

    const fingerprint = ssh.hostKeyFingerprint ? normalizeFingerprint(ssh.hostKeyFingerprint) : null
    const connectPromise = new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve())
      client.once('error', reject)
      client.once('close', () => {
        if (!entry.closed) {
          void this.closeEntry(entry)
        }
      })
    })

    client.connect({
      host: ssh.host,
      port: ssh.port,
      username: ssh.username,
      ...(ssh.authMethod === 'privateKey'
        ? {
            privateKey: ssh.privateKey,
            passphrase: ssh.passphrase,
          }
        : {
            password: ssh.password,
          }),
      ...(fingerprint
        ? {
            hostHash: 'sha256',
            hostVerifier: (hash: string) => normalizeFingerprint(hash) === fingerprint,
          }
        : {}),
    })

    await connectPromise

    try {
      const server = net.createServer((socket) => {
        client.forwardOut(
          socket.localAddress ?? '127.0.0.1',
          socket.localPort ?? 0,
          remoteHost,
          remotePort,
          (error, upstream) => {
            if (error || !upstream) {
              socket.destroy(error ?? new Error('Unable to open SSH tunnel stream'))
              return
            }

            upstream.on('error', (streamError) => socket.destroy(streamError))
            socket.on('error', () => upstream.destroy())
            socket.pipe(upstream)
            upstream.pipe(socket)
          },
        )
      })

      entry.server = server
      server.on('error', () => {
        void this.closeEntry(entry)
      })

      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => resolve())
      })

      const address = server.address() as AddressInfo | null
      if (!address?.port) {
        throw new Error('Unable to allocate a local SSH tunnel port')
      }

      entry.localPort = address.port
    } catch (error) {
      client.end()
      throw error
    }
  }

  private async closeEntry(entry: TunnelEntry) {
    if (entry.closed) {
      return
    }

    entry.closed = true
    clearTimeout(entry.closeTimer)
    this.entries.delete(entry.key)

    await Promise.allSettled([
      entry.server
        ? new Promise<void>((resolve) => entry.server!.close(() => resolve()))
        : Promise.resolve(),
      Promise.resolve().then(() => entry.client?.end()),
    ])
  }
}
