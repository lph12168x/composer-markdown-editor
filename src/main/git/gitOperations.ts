import type { WorkspaceRoot } from '../../types/file'
import type { GitRepoStatus } from '../../types/git'
import * as local from './localGitClient'
import * as remote from './remoteGitClient'

function resolveRepoPath(rootPath: string, repoPath: string): string {
  if (repoPath === '.') return rootPath
  return `${rootPath}/${repoPath}`
}

function assertPath(root: WorkspaceRoot): asserts root is WorkspaceRoot & { path: string } {
  if (!root.path) {
    throw new Error('Workspace root has no path')
  }
}

export async function getRepoStatuses(root: WorkspaceRoot): Promise<GitRepoStatus[]> {
  assertPath(root)
  if (root.type === 'local') {
    return local.getRepoStatuses(root.path)
  }
  return remote.getRepoStatuses(root.path)
}

export async function initGitRepo(root: WorkspaceRoot): Promise<void> {
  assertPath(root)
  if (root.type === 'local') {
    await local.initGitRepo(root.path)
    return
  }
  await remote.initGitRepo(root.path)
}

export async function commitGitChanges(
  root: WorkspaceRoot,
  repoPath: string,
  message: string
): Promise<void> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    await local.commitGitChanges(target, message)
    return
  }
  await remote.commitGitChanges(target, message)
}

export async function stageFile(
  root: WorkspaceRoot,
  repoPath: string,
  filePath: string
): Promise<void> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    await local.stageFile(target, filePath)
    return
  }
  await remote.stageFile(target, filePath)
}

export async function unstageFile(
  root: WorkspaceRoot,
  repoPath: string,
  filePath: string
): Promise<void> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    await local.unstageFile(target, filePath)
    return
  }
  await remote.unstageFile(target, filePath)
}

export async function getGitLog(root: WorkspaceRoot): Promise<GitRepoStatus['history']> {
  assertPath(root)
  if (root.type === 'local') {
    return local.getGitLog(root.path)
  }
  return remote.getGitLog(root.path)
}

export async function getGitDiff(
  root: WorkspaceRoot,
  repoPath: string,
  filePath: string
): Promise<string> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    return local.getGitDiff(target, filePath)
  }
  return remote.getGitDiff(target, filePath)
}

export async function getGitBranches(
  root: WorkspaceRoot,
  repoPath: string
): Promise<string[]> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    return local.getGitBranches(target)
  }
  return remote.getGitBranches(target)
}

export async function checkoutGitBranch(
  root: WorkspaceRoot,
  repoPath: string,
  branchName: string
): Promise<void> {
  assertPath(root)
  const target = resolveRepoPath(root.path, repoPath)
  if (root.type === 'local') {
    await local.checkoutGitBranch(target, branchName)
    return
  }
  await remote.checkoutGitBranch(target, branchName)
}
