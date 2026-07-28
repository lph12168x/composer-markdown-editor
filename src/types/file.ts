export interface WorkspaceRoot {
  id: string
  type: 'local' | 'ssh'
  name: string
  path?: string
  /**
   * Identifier of the `RecentSshConnection` this root was opened with.
   * Reserved for future use — today the (host, username) pair on the root
   * is what we match against when recovering the session.
   */
  connectionId?: string
  /**
   * SSH host the root is bound to. Used to recover the saved credentials
   * when the user clicks back into a previously-opened remote folder.
   */
  host?: string
  /** SSH username matching `host`. */
  username?: string
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
  /**
   * What kind of file this is. Markdown documents keep the legacy string
   * `content`; image documents carry a base64 `dataUrl` and are read-only.
   */
  kind: 'markdown' | 'image'
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
  readFileAsDataUrl(ref: FileRef): Promise<string>
  writeFile(ref: FileRef, content: string): Promise<void>
  createFile(parent: FileRef, name: string): Promise<FileRef>
  createDir(parent: FileRef, name: string): Promise<FileRef>
  rename(ref: FileRef, newName: string): Promise<FileRef>
  delete(ref: FileRef): Promise<void>
  stat(ref: FileRef): Promise<FileStat>
}
