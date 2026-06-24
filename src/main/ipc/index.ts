import { registerFileSystemIPC } from './fileSystem'
import { registerDialogIPC } from './dialog'
import { registerSshIPC } from './ssh'
import { registerGitIPC } from './git'

export function registerIpcHandlers(): void {
  registerFileSystemIPC()
  registerDialogIPC()
  registerSshIPC()
  registerGitIPC()
}
