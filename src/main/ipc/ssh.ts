import { ipcMain } from 'electron'
import { SSH_CHANNELS } from '../../types/ipc'
import type { SshConnectionConfig, SshConnectionStatus } from '../../types/ssh'
import { sshConnectionManager } from '../ssh/sshClient'
import { sftpRealpath } from '../ssh/sftpClient'

export interface ConnectResult {
  status: SshConnectionStatus
  homePath: string
}

export function registerSshIPC(): void {
  ipcMain.handle(SSH_CHANNELS.CONNECT, async (_, config: SshConnectionConfig): Promise<ConnectResult> => {
    const status = await sshConnectionManager.connect(config)
    const sftp = await sshConnectionManager.getSftp()
    const homePath = await sftpRealpath(sftp, '.')
    return { status, homePath }
  })

  ipcMain.handle(SSH_CHANNELS.DISCONNECT, async (): Promise<SshConnectionStatus> => {
    await sshConnectionManager.disconnect()
    return sshConnectionManager.getStatus()
  })

  ipcMain.handle(SSH_CHANNELS.STATUS, async (): Promise<SshConnectionStatus> => {
    return sshConnectionManager.getStatus()
  })
}
