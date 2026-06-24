export interface GitChange {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'staged'
}

export interface GitLogEntry {
  hash: string
  date: string
  message: string
  author_name: string
}

export interface GitRepoStatus {
  path: string
  isRepo: boolean
  branch: string | null
  ahead: number
  behind: number
  changes: GitChange[]
  history: GitLogEntry[]
}
