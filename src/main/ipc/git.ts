import path from 'node:path'
import { ipcMain } from 'electron'
import { GIT_CHANNELS } from '../../types/ipc'
import type { GitRepoStatus } from '../../types/git'
import {
  checkoutGitBranch,
  commitGitChanges,
  getGitBranches,
  getGitDiff,
  getGitLog,
  getRepoStatuses,
  initGitRepo,
  stageFile,
  unstageFile
} from '../git/gitClient'

function resolveRepoPath(rootPath: string, repoPath: string): string {
  return repoPath === '.' ? rootPath : path.join(rootPath, repoPath)
}

export function registerGitIPC(): void {
  ipcMain.handle(GIT_CHANNELS.STATUS, async (_, rootPath: string): Promise<GitRepoStatus[]> => {
    return getRepoStatuses(rootPath)
  })

  ipcMain.handle(GIT_CHANNELS.INIT, async (_, rootPath: string): Promise<void> => {
    await initGitRepo(rootPath)
  })

  ipcMain.handle(
    GIT_CHANNELS.COMMIT,
    async (_, payload: { rootPath: string; repoPath: string; message: string }): Promise<void> => {
      await commitGitChanges(resolveRepoPath(payload.rootPath, payload.repoPath), payload.message)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.STAGE,
    async (_, payload: { rootPath: string; repoPath: string; filePath: string }): Promise<void> => {
      await stageFile(resolveRepoPath(payload.rootPath, payload.repoPath), payload.filePath)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.UNSTAGE,
    async (_, payload: { rootPath: string; repoPath: string; filePath: string }): Promise<void> => {
      await unstageFile(resolveRepoPath(payload.rootPath, payload.repoPath), payload.filePath)
    }
  )

  ipcMain.handle(GIT_CHANNELS.LOG, async (_, rootPath: string) => {
    return getGitLog(rootPath)
  })

  ipcMain.handle(
    GIT_CHANNELS.DIFF,
    async (_, payload: { rootPath: string; repoPath: string; filePath: string }): Promise<string> => {
      return getGitDiff(resolveRepoPath(payload.rootPath, payload.repoPath), payload.filePath)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.BRANCHES,
    async (_, payload: { rootPath: string; repoPath: string }): Promise<string[]> => {
      return getGitBranches(resolveRepoPath(payload.rootPath, payload.repoPath))
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.CHECKOUT,
    async (_, payload: { rootPath: string; repoPath: string; branchName: string }): Promise<void> => {
      await checkoutGitBranch(resolveRepoPath(payload.rootPath, payload.repoPath), payload.branchName)
    }
  )
}
