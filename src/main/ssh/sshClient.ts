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

  async execCommand(command: string): Promise<{ stdout: string; stderr: string; code: number }> {
    if (this.connecting) {
      await this.connecting
    }

    if (!this.connection) {
      throw new Error('SSH connection is not established')
    }

    return new Promise((resolve, reject) => {
      this.connection!.client.exec(command, (err, stream) => {
        if (err) {
          reject(err)
          return
        }

        let stdout = ''
        let stderr = ''

        stream
          .on('close', (code: number) => {
            resolve({ stdout, stderr, code })
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString('utf-8')
          })
          .stderr.on('data', (data: Buffer) => {
            stderr += data.toString('utf-8')
          })
      })
    })
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
