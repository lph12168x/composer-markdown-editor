import type { FileRef, FileSystemProvider, FileStat, WorkspaceRoot } from '../types/file'

export class SshFileSystemProvider implements FileSystemProvider {
  async readDir(_root: WorkspaceRoot, _ref: FileRef): Promise<FileRef[]> {
    throw new Error('SSH provider not implemented yet')
  }

  async readFile(_ref: FileRef): Promise<string> {
    throw new Error('SSH provider not implemented yet')
  }

  async writeFile(_ref: FileRef, _content: string): Promise<void> {
    throw new Error('SSH provider not implemented yet')
  }

  async createFile(_parent: FileRef, _name: string): Promise<FileRef> {
    throw new Error('SSH provider not implemented yet')
  }

  async createDir(_parent: FileRef, _name: string): Promise<FileRef> {
    throw new Error('SSH provider not implemented yet')
  }

  async rename(_ref: FileRef, _newName: string): Promise<FileRef> {
    throw new Error('SSH provider not implemented yet')
  }

  async delete(_ref: FileRef): Promise<void> {
    throw new Error('SSH provider not implemented yet')
  }

  async stat(_ref: FileRef): Promise<FileStat> {
    throw new Error('SSH provider not implemented yet')
  }
}
