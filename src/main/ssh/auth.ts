import fs from 'node:fs/promises'
import type { ConnectConfig } from 'ssh2'
import type { SshConnectionConfig } from '../../types/ssh'

export async function buildSshConfig(config: SshConnectionConfig): Promise<ConnectConfig> {
  const base: ConnectConfig = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 20000
  }

  switch (config.auth) {
    case 'password':
      if (!config.password) {
        throw new Error('Password is required for password authentication')
      }
      return {
        ...base,
        password: config.password
      }

    case 'privateKey': {
      if (!config.privateKeyPath) {
        throw new Error('Private key path is required for key authentication')
      }
      const privateKey = await fs.readFile(config.privateKeyPath)
      return {
        ...base,
        privateKey,
        passphrase: config.passphrase || undefined
      }
    }

    case 'agent': {
      const agent = process.env.SSH_AUTH_SOCK
      if (!agent) {
        throw new Error('SSH_AUTH_SOCK environment variable is not set')
      }
      return {
        ...base,
        agent
      }
    }

    default:
      throw new Error(`Unsupported authentication method: ${config.auth}`)
  }
}
