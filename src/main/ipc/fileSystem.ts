import { ipcMain } from 'electron'
import type { FileRef } from '../../types/file'
import { fileSystemService } from '../../services/fileSystem'
import { LocalFileSystemProvider } from '../../services/localProvider'
import { SshFileSystemProvider } from '../../services/sshProvider'
import {
  FS_CHANNELS,
  type CreatePayload,
  type ReadDirPayload,
  type RenamePayload,
  type WriteFilePayload
} from '../../types/ipc'

export function registerFileSystemIPC(): void {
  fileSystemService.register('local', new LocalFileSystemProvider())
  fileSystemService.register('ssh', new SshFileSystemProvider())

  ipcMain.handle(FS_CHANNELS.READ_DIR, async (_, payload: ReadDirPayload) => {
    return fileSystemService.readDir(payload.root, payload.ref)
  })

  ipcMain.handle(FS_CHANNELS.READ_FILE, async (_, ref: FileRef) => {
    return fileSystemService.readFile(ref)
  })

  ipcMain.handle(FS_CHANNELS.WRITE_FILE, async (_, payload: WriteFilePayload) => {
    return fileSystemService.writeFile(payload.ref, payload.content)
  })

  ipcMain.handle(FS_CHANNELS.CREATE_FILE, async (_, payload: CreatePayload) => {
    return fileSystemService.createFile(payload.parent, payload.name)
  })

  ipcMain.handle(FS_CHANNELS.CREATE_DIR, async (_, payload: CreatePayload) => {
    return fileSystemService.createDir(payload.parent, payload.name)
  })

  ipcMain.handle(FS_CHANNELS.RENAME, async (_, payload: RenamePayload) => {
    return fileSystemService.rename(payload.ref, payload.newName)
  })

  ipcMain.handle(FS_CHANNELS.DELETE, async (_, ref: FileRef) => {
    return fileSystemService.delete(ref)
  })

  ipcMain.handle(FS_CHANNELS.STAT, async (_, ref: FileRef) => {
    return fileSystemService.stat(ref)
  })
}
