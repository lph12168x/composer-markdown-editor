import type { FileRef, FileStat, WorkspaceRoot } from '../types/file'
import {
  FS_CHANNELS,
  type CreatePayload,
  type ReadDirPayload,
  type RenamePayload,
  type WriteFilePayload
} from '../types/ipc'

class FileSystemClient {
  async readDir(root: WorkspaceRoot, ref: FileRef): Promise<FileRef[]> {
    const payload: ReadDirPayload = { root, ref }
    return window.electronAPI.invoke<FileRef[]>(FS_CHANNELS.READ_DIR, payload)
  }

  async readFile(ref: FileRef): Promise<string> {
    return window.electronAPI.invoke<string>(FS_CHANNELS.READ_FILE, ref)
  }

  async writeFile(ref: FileRef, content: string): Promise<void> {
    const payload: WriteFilePayload = { ref, content }
    return window.electronAPI.invoke<void>(FS_CHANNELS.WRITE_FILE, payload)
  }

  async createFile(parent: FileRef, name: string): Promise<FileRef> {
    const payload: CreatePayload = { parent, name }
    return window.electronAPI.invoke<FileRef>(FS_CHANNELS.CREATE_FILE, payload)
  }

  async createDir(parent: FileRef, name: string): Promise<FileRef> {
    const payload: CreatePayload = { parent, name }
    return window.electronAPI.invoke<FileRef>(FS_CHANNELS.CREATE_DIR, payload)
  }

  async rename(ref: FileRef, newName: string): Promise<FileRef> {
    const payload: RenamePayload = { ref, newName }
    return window.electronAPI.invoke<FileRef>(FS_CHANNELS.RENAME, payload)
  }

  async delete(ref: FileRef): Promise<void> {
    return window.electronAPI.invoke<void>(FS_CHANNELS.DELETE, ref)
  }

  async stat(ref: FileRef): Promise<FileStat> {
    return window.electronAPI.invoke<FileStat>(FS_CHANNELS.STAT, ref)
  }

  async openFolder(): Promise<string | null> {
    return window.electronAPI.invoke<string | null>('dialog:openFolder')
  }
}

export const fileSystemClient = new FileSystemClient()
