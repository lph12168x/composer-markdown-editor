import { create } from 'zustand'
import type { WorkspaceRoot } from '../types/file'
import type { GitRepoStatus } from '../types/git'
import { gitClient } from '../services/gitClient'

interface GitState {
  repos: GitRepoStatus[]
  loading: boolean
  error: string | null
  loadStatus: (root: WorkspaceRoot) => Promise<void>
  initRepo: (root: WorkspaceRoot) => Promise<void>
  stage: (root: WorkspaceRoot, repoPath: string, filePath: string) => Promise<void>
  unstage: (root: WorkspaceRoot, repoPath: string, filePath: string) => Promise<void>
  commit: (root: WorkspaceRoot, repoPath: string, message: string) => Promise<void>
  clear: () => void
}

function isLocalRoot(root: WorkspaceRoot): root is WorkspaceRoot & { path: string } {
  return root.type === 'local' && typeof root.path === 'string' && root.path.length > 0
}

export const useGitStore = create<GitState>((set) => ({
  repos: [],
  loading: false,
  error: null,

  loadStatus: async (root: WorkspaceRoot) => {
    if (!isLocalRoot(root)) {
      set({ repos: [], error: null })
      return
    }

    set({ loading: true, error: null })
    try {
      const repos = await gitClient.status(root.path)
      set({ repos, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Git status'
      set({ repos: [], loading: false, error: message })
    }
  },

  initRepo: async (root: WorkspaceRoot) => {
    if (!isLocalRoot(root)) {
      set({ error: 'Only local directories can be initialized as Git repositories' })
      return
    }

    set({ loading: true, error: null })
    try {
      await gitClient.init(root.path)
      const repos = await gitClient.status(root.path)
      set({ repos, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Git repository'
      set({ loading: false, error: message })
    }
  },

  stage: async (root: WorkspaceRoot, repoPath: string, filePath: string) => {
    if (!isLocalRoot(root)) {
      throw new Error('Only local directories can be staged')
    }

    try {
      await gitClient.stage(root.path, repoPath, filePath)
      const repos = await gitClient.status(root.path)
      set({ repos, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stage file'
      set({ error: message })
      throw new Error(message)
    }
  },

  unstage: async (root: WorkspaceRoot, repoPath: string, filePath: string) => {
    if (!isLocalRoot(root)) {
      throw new Error('Only local directories can be unstaged')
    }

    try {
      await gitClient.unstage(root.path, repoPath, filePath)
      const repos = await gitClient.status(root.path)
      set({ repos, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unstage file'
      set({ error: message })
      throw new Error(message)
    }
  },

  commit: async (root: WorkspaceRoot, repoPath: string, message: string) => {
    if (!isLocalRoot(root)) {
      throw new Error('Only local directories can be committed')
    }
    if (!message.trim()) {
      throw new Error('Commit message is required')
    }

    set({ loading: true, error: null })
    try {
      await gitClient.commit(root.path, repoPath, message.trim())
      const repos = await gitClient.status(root.path)
      set({ repos, loading: false })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to commit changes'
      set({ loading: false, error: errorMessage })
      throw new Error(errorMessage)
    }
  },

  clear: () => {
    set({ repos: [], loading: false, error: null })
  }
}))
