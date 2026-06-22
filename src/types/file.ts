export interface WorkspaceRoot {
  id: string
  type: 'local' | 'ssh'
  name: string
  path?: string
  connectionId?: string
}

export interface Workspace {
  id: string
  name: string
  roots: WorkspaceRoot[]
  activeRootId?: string
}

export interface FileRef {
  id: string
  rootId: string
  type: 'local' | 'ssh'
  path: string
  name: string
  isDirectory: boolean
}

export interface Document {
  ref: FileRef
  content: string
  rawContent: string
  originalContent: string
  modified: boolean
  loading: boolean
  error?: string
  lastModifiedEditor: 'wysiwyg' | 'source' | null
  hasNormalized: boolean
}

export interface FileStat {
  size: number
  mtime: Date
}

export interface FileSystemProvider {
  readDir(root: WorkspaceRoot, ref: FileRef): Promise<FileRef[]>
  readFile(ref: FileRef): Promise<string>
  writeFile(ref: FileRef, content: string): Promise<void>
  createFile(parent: FileRef, name: string): Promise<FileRef>
  createDir(parent: FileRef, name: string): Promise<FileRef>
  rename(ref: FileRef, newName: string): Promise<FileRef>
  delete(ref: FileRef): Promise<void>
  stat(ref: FileRef): Promise<FileStat>
}
