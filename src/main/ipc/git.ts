import { ipcMain } from 'electron'
import { GIT_CHANNELS } from '../../types/ipc'
import type { WorkspaceRoot } from '../../types/file'
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
} from '../git/gitOperations'

export function registerGitIPC(): void {
  ipcMain.handle(GIT_CHANNELS.STATUS, async (_, root: WorkspaceRoot): Promise<GitRepoStatus[]> => {
    return getRepoStatuses(root)
  })

  ipcMain.handle(GIT_CHANNELS.INIT, async (_, root: WorkspaceRoot): Promise<void> => {
    await initGitRepo(root)
  })

  ipcMain.handle(
    GIT_CHANNELS.COMMIT,
    async (_, payload: { root: WorkspaceRoot; repoPath: string; message: string }): Promise<void> => {
      await commitGitChanges(payload.root, payload.repoPath, payload.message)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.STAGE,
    async (_, payload: { root: WorkspaceRoot; repoPath: string; filePath: string }): Promise<void> => {
      await stageFile(payload.root, payload.repoPath, payload.filePath)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.UNSTAGE,
    async (_, payload: { root: WorkspaceRoot; repoPath: string; filePath: string }): Promise<void> => {
      await unstageFile(payload.root, payload.repoPath, payload.filePath)
    }
  )

  ipcMain.handle(GIT_CHANNELS.LOG, async (_, root: WorkspaceRoot) => {
    return getGitLog(root)
  })

  ipcMain.handle(
    GIT_CHANNELS.DIFF,
    async (_, payload: { root: WorkspaceRoot; repoPath: string; filePath: string }): Promise<string> => {
      return getGitDiff(payload.root, payload.repoPath, payload.filePath)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.BRANCHES,
    async (_, payload: { root: WorkspaceRoot; repoPath: string }): Promise<string[]> => {
      return getGitBranches(payload.root, payload.repoPath)
    }
  )

  ipcMain.handle(
    GIT_CHANNELS.CHECKOUT,
    async (_, payload: { root: WorkspaceRoot; repoPath: string; branchName: string }): Promise<void> => {
      await checkoutGitBranch(payload.root, payload.repoPath, payload.branchName)
    }
  )
}
