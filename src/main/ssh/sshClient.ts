import { Client, type SFTPWrapper } from 'ssh2'
import type { SshConnectionConfig, SshConnectionStatus } from '../../types/ssh'
import { buildSshConfig } from './auth'

interface ActiveConnection {
  client: Client
  sftp: SFTPWrapper
  host: string
  username: string
}

class SshConnectionManager {
  private connection: ActiveConnection | null = null
  private connecting: Promise<ActiveConnection> | null = null

  async connect(config: SshConnectionConfig): Promise<SshConnectionStatus> {
    if (this.connection) {
      await this.disconnect()
    }

    const sshConfig = await buildSshConfig(config)

    this.connecting = new Promise<ActiveConnection>((resolve, reject) => {
      const client = new Client()

      client
        .on('ready', () => {
          client.sftp((err, sftp) => {
            if (err) {
              client.end()
              reject(err)
              return
            }
            const active: ActiveConnection = {
              client,
              sftp,
              host: config.host,
              username: config.username
            }
            resolve(active)
          })
        })
        .on('error', (err) => {
          reject(err)
        })
        .connect(sshConfig)
    })

    try {
      this.connection = await this.connecting
      return {
        connected: true,
        host: this.connection.host,
        username: this.connection.username
      }
    } catch (err) {
      this.connection = null
      throw err
    } finally {
      this.connecting = null
    }
  }

  async disconnect(): Promise<void> {
    if (this.connecting) {
      try {
        await this.connecting
      } catch {
        // ignore connection errors during disconnect
      }
    }

    if (this.connection) {
      this.connection.client.end()
      this.connection = null
    }
  }

  async getSftp(): Promise<SFTPWrapper> {
    if (this.connecting) {
      const conn = await this.connecting
      return conn.sftp
    }

    if (!this.connection) {
      throw new Error('SSH connection is not established')
    }

    return this.connection.sftp
  }

  getStatus(): SshConnectionStatus {
    if (this.connection) {
      return {
        connected: true,
        host: this.connection.host,
        username: this.connection.username
      }
    }

    return { connected: false }
  }
}

export const sshConnectionManager = new SshConnectionManager()
