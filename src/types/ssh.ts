export type SshAuthMethod = 'password' | 'privateKey' | 'agent'

export interface SshConnectionConfig {
  host: string
  port: number
  username: string
  auth: SshAuthMethod
  password?: string
  privateKeyPath?: string
  passphrase?: string
}

export interface SshConnectionStatus {
  connected: boolean
  host?: string
  username?: string
  error?: string
}
