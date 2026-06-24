import { GIT_CHANNELS } from '../types/ipc'
import type { GitRepoStatus } from '../types/git'

class GitClient {
  async status(rootPath: string): Promise<GitRepoStatus[]> {
    return window.electronAPI.invoke<GitRepoStatus[]>(GIT_CHANNELS.STATUS, rootPath)
  }

  async init(rootPath: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.INIT, rootPath)
  }

  async commit(rootPath: string, repoPath: string, message: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.COMMIT, { rootPath, repoPath, message })
  }

  async stage(rootPath: string, repoPath: string, filePath: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.STAGE, { rootPath, repoPath, filePath })
  }

  async unstage(rootPath: string, repoPath: string, filePath: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.UNSTAGE, { rootPath, repoPath, filePath })
  }

  async log(rootPath: string) {
    return window.electronAPI.invoke<GitRepoStatus['history']>(GIT_CHANNELS.LOG, rootPath)
  }

  async diff(rootPath: string, repoPath: string, filePath: string): Promise<string> {
    return window.electronAPI.invoke<string>(GIT_CHANNELS.DIFF, { rootPath, repoPath, filePath })
  }

  async branches(rootPath: string, repoPath: string): Promise<string[]> {
    return window.electronAPI.invoke<string[]>(GIT_CHANNELS.BRANCHES, { rootPath, repoPath })
  }

  async checkout(rootPath: string, repoPath: string, branchName: string): Promise<void> {
    return window.electronAPI.invoke<void>(GIT_CHANNELS.CHECKOUT, { rootPath, repoPath, branchName })
  }
}

export const gitClient = new GitClient()
