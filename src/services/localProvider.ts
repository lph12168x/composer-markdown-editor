import fs from 'node:fs/promises'
import path from 'node:path'
import type { FileRef, FileSystemProvider, FileStat, WorkspaceRoot } from '../types/file'

function createFileRef(rootId: string, filePath: string, isDirectory: boolean): FileRef {
  return {
    id: `${rootId}:${filePath}`,
    rootId,
    type: 'local',
    path: filePath,
    name: path.basename(filePath),
    isDirectory
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export class LocalFileSystemProvider implements FileSystemProvider {
  async readDir(root: WorkspaceRoot, ref: FileRef): Promise<FileRef[]> {
    const dirPath = ref.path
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .map((entry) => createFileRef(root.id, path.join(dirPath, entry.name), entry.isDirectory()))
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name)
        }
        return a.isDirectory ? -1 : 1
      })
  }

  async readFile(ref: FileRef): Promise<string> {
    return fs.readFile(ref.path, 'utf-8')
  }

  async writeFile(ref: FileRef, content: string): Promise<void> {
    await fs.writeFile(ref.path, content, 'utf-8')
  }

  async createFile(parent: FileRef, name: string): Promise<FileRef> {
    const filePath = path.join(parent.path, name)
    if (await pathExists(filePath)) {
      throw new Error(`A file or folder named "${name}" already exists.`)
    }
    await fs.writeFile(filePath, '', 'utf-8')
    return createFileRef(parent.rootId, filePath, false)
  }

  async createDir(parent: FileRef, name: string): Promise<FileRef> {
    const dirPath = path.join(parent.path, name)
    if (await pathExists(dirPath)) {
      throw new Error(`A file or folder named "${name}" already exists.`)
    }
    await fs.mkdir(dirPath)
    return createFileRef(parent.rootId, dirPath, true)
  }

  async rename(ref: FileRef, newName: string): Promise<FileRef> {
    const newPath = path.join(path.dirname(ref.path), newName)
    if (newPath !== ref.path && (await pathExists(newPath))) {
      throw new Error(`A file or folder named "${newName}" already exists.`)
    }
    await fs.rename(ref.path, newPath)
    return createFileRef(ref.rootId, newPath, ref.isDirectory)
  }

  async delete(ref: FileRef): Promise<void> {
    if (ref.isDirectory) {
      await fs.rm(ref.path, { recursive: true, force: true })
    } else {
      await fs.unlink(ref.path)
    }
  }

  async stat(ref: FileRef): Promise<FileStat> {
    const s = await fs.stat(ref.path)
    return { size: s.size, mtime: s.mtime }
  }
}
