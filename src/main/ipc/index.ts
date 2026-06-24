import { registerFileSystemIPC } from './fileSystem'
import { registerDialogIPC } from './dialog'
import { registerSshIPC } from './ssh'

export function registerIpcHandlers(): void {
  registerFileSystemIPC()
  registerDialogIPC()
  registerSshIPC()
}
