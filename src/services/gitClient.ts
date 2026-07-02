import { GIT_CHANNELS } from '../types/ipc'
import type { WorkspaceRoot } from '../types/file'
import type { GitRepoStatus } from '../types/git'

class GitClient {
  async status(root: WorkspaceRoot): Promise<GitRepoStatus[]> {
    return window.electronAPI.invoke<GitRepoStatus[]>(GIT_CHANNELS.STATUS, root)
  }

  async init(root: WorkspaceRoot): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.INIT, root)
  }

  async commit(root: WorkspaceRoot, repoPath: string, message: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.COMMIT, { root, repoPath, message })
  }

  async stage(root: WorkspaceRoot, repoPath: string, filePath: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.STAGE, { root, repoPath, filePath })
  }

  async unstage(root: WorkspaceRoot, repoPath: string, filePath: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.UNSTAGE, { root, repoPath, filePath })
  }

  async log(root: WorkspaceRoot) {
    return window.electronAPI.invoke<GitRepoStatus['history']>(GIT_CHANNELS.LOG, root)
  }

  async diff(root: WorkspaceRoot, repoPath: string, filePath: string): Promise<string> {
    return window.electronAPI.invoke<string>(GIT_CHANNELS.DIFF, { root, repoPath, filePath })
  }

  async branches(root: WorkspaceRoot, repoPath: string): Promise<string[]> {
    return window.electronAPI.invoke<string[]>(GIT_CHANNELS.BRANCHES, { root, repoPath })
  }

  async checkout(root: WorkspaceRoot, repoPath: string, branchName: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.CHECKOUT, { root, repoPath, branchName })
  }
}

export const gitClient = new GitClient()
