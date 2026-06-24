import path from 'node:path'
import type { FileRef, FileStat, FileSystemProvider, WorkspaceRoot } from '../types/file'
import { sshConnectionManager } from '../main/ssh/sshClient'
import {
  sftpCreateFile,
  sftpMkdir,
  sftpReadFile,
  sftpReaddir,
  sftpRemoveRecursive,
  sftpRename,
  sftpStat,
  sftpWriteFile
} from '../main/ssh/sftpClient'

function createFileRef(rootId: string, filePath: string, isDirectory: boolean): FileRef {
  return {
    id: `${rootId}:${filePath}`,
    rootId,
    type: 'ssh',
    path: filePath,
    name: path.posix.basename(filePath),
    isDirectory
  }
}

export class SshFileSystemProvider implements FileSystemProvider {
  async readDir(root: WorkspaceRoot, ref: FileRef): Promise<FileRef[]> {
    const sftp = await sshConnectionManager.getSftp()
    const entries = await sftpReaddir(sftp, ref.path)

    return entries
      .map((entry) => createFileRef(root.id, path.posix.join(ref.path, entry.filename), entry.attrs.isDirectory()))
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name)
        }
        return a.isDirectory ? -1 : 1
      })
  }

  async readFile(ref: FileRef): Promise<string> {
    const sftp = await sshConnectionManager.getSftp()
    return sftpReadFile(sftp, ref.path)
  }

  async writeFile(ref: FileRef, content: string): Promise<void> {
    const sftp = await sshConnectionManager.getSftp()
    await sftpWriteFile(sftp, ref.path, content)
  }

  async createFile(parent: FileRef, name: string): Promise<FileRef> {
    const filePath = path.posix.join(parent.path, name)
    const sftp = await sshConnectionManager.getSftp()
    await sftpCreateFile(sftp, filePath)
    return createFileRef(parent.rootId, filePath, false)
  }

  async createDir(parent: FileRef, name: string): Promise<FileRef> {
    const dirPath = path.posix.join(parent.path, name)
    const sftp = await sshConnectionManager.getSftp()
    await sftpMkdir(sftp, dirPath)
    return createFileRef(parent.rootId, dirPath, true)
  }

  async rename(ref: FileRef, newName: string): Promise<FileRef> {
    const newPath = path.posix.join(path.posix.dirname(ref.path), newName)
    const sftp = await sshConnectionManager.getSftp()
    await sftpRename(sftp, ref.path, newPath)
    return createFileRef(ref.rootId, newPath, ref.isDirectory)
  }

  async delete(ref: FileRef): Promise<void> {
    const sftp = await sshConnectionManager.getSftp()
    await sftpRemoveRecursive(sftp, ref.path)
  }

  async stat(ref: FileRef): Promise<FileStat> {
    const sftp = await sshConnectionManager.getSftp()
    return sftpStat(sftp, ref.path)
  }
}
