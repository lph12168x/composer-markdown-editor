import type { FileRef, FileSystemProvider, WorkspaceRoot } from '../types/file'

class FileSystemService {
  private providers: Map<'local' | 'ssh', FileSystemProvider> = new Map()

  register(type: 'local' | 'ssh', provider: FileSystemProvider): void {
    this.providers.set(type, provider)
  }

  private getProvider(type: 'local' | 'ssh'): FileSystemProvider {
    const provider = this.providers.get(type)
    if (!provider) {
      throw new Error(`No provider registered for type: ${type}`)
    }
    return provider
  }

  async readDir(root: WorkspaceRoot, ref: FileRef): Promise<FileRef[]> {
    return this.getProvider(ref.type).readDir(root, ref)
  }

  async readFile(ref: FileRef): Promise<string> {
    return this.getProvider(ref.type).readFile(ref)
  }

  async writeFile(ref: FileRef, content: string): Promise<void> {
    return this.getProvider(ref.type).writeFile(ref, content)
  }

  async createFile(parent: FileRef, name: string): Promise<FileRef> {
    return this.getProvider(parent.type).createFile(parent, name)
  }

  async createDir(parent: FileRef, name: string): Promise<FileRef> {
    return this.getProvider(parent.type).createDir(parent, name)
  }

  async rename(ref: FileRef, newName: string): Promise<FileRef> {
    return this.getProvider(ref.type).rename(ref, newName)
  }

  async delete(ref: FileRef): Promise<void> {
    return this.getProvider(ref.type).delete(ref)
  }

  async stat(ref: FileRef): Promise<{ size: number; mtime: Date }> {
    return this.getProvider(ref.type).stat(ref)
  }
}

export const fileSystemService = new FileSystemService()
