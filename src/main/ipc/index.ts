import { registerFileSystemIPC } from './fileSystem'
import { registerDialogIPC } from './dialog'

export function registerIpcHandlers(): void {
  registerFileSystemIPC()
  registerDialogIPC()
}
