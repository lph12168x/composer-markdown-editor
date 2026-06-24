import fs from 'node:fs/promises'
import path from 'node:path'
import simpleGit from 'simple-git'
import type { GitChange, GitLogEntry, GitRepoStatus } from '../../types/git'

function getDiffFilePath(filePath: string): string {
  if (filePath.includes(' -> ')) {
    return filePath.split(' -> ').pop() ?? filePath
  }
  return filePath
}

const MAX_SCAN_DEPTH = 3

function getGit(repoPath: string) {
  return simpleGit(repoPath)
}

function normalizeChange(filePath: string, status: GitChange['status']): GitChange {
  return { path: filePath, status }
}

export async function findGitRepos(rootPath: string): Promise<string[]> {
  const repos: string[] = []
  const absoluteRoot = path.resolve(rootPath)

  if (await isGitRepo(absoluteRoot)) {
    repos.push('.')
  }

  await scanForRepos(absoluteRoot, absoluteRoot, 1, repos)
  return repos
}

async function isGitRepo(dirPath: string): Promise<boolean> {
  try {
    const gitDir = path.join(dirPath, '.git')
    const stat = await fs.stat(gitDir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function scanForRepos(
  rootPath: string,
  currentPath: string,
  depth: number,
  repos: string[]
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return

  let entries
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '.git' || entry.name === 'node_modules') continue

    const childPath = path.join(currentPath, entry.name)
    if (await isGitRepo(childPath)) {
      repos.push(path.relative(rootPath, childPath))
    } else {
      await scanForRepos(rootPath, childPath, depth + 1, repos)
    }
  }
}

export async function getGitStatus(repoPath: string): Promise<Omit<GitRepoStatus, 'path'>> {
  const git = getGit(repoPath)
  const isRepo = await git.checkIsRepo()

  if (!isRepo) {
    return {
      isRepo: false,
      branch: null,
      ahead: 0,
      behind: 0,
      changes: [],
      history: []
    }
  }

  const status = await git.status()
  const log = await git.log({ n: 5 })

  const changeMap = new Map<string, GitChange['status']>()

  for (const file of status.staged) {
    changeMap.set(file, 'staged')
  }

  for (const file of status.modified) {
    if (!changeMap.has(file)) {
      changeMap.set(file, 'modified')
    }
  }

  for (const file of status.not_added) {
    if (!changeMap.has(file)) {
      changeMap.set(file, 'added')
    }
  }

  for (const file of status.deleted) {
    if (!changeMap.has(file)) {
      changeMap.set(file, 'deleted')
    }
  }

  for (const file of status.renamed) {
    if (!changeMap.has(file.from)) {
      changeMap.set(`${file.from} -> ${file.to}`, 'renamed')
    }
  }

  const changes: GitChange[] = Array.from(changeMap.entries())
    .map(([filePath, fileStatus]) => normalizeChange(filePath, fileStatus))
    .sort((a, b) => a.path.localeCompare(b.path))

  const history: GitLogEntry[] = log.all.map((entry) => ({
    hash: entry.hash,
    date: entry.date,
    message: entry.message,
    author_name: entry.author_name
  }))

  return {
    isRepo: true,
    branch: status.current || null,
    ahead: status.ahead || 0,
    behind: status.behind || 0,
    changes,
    history
  }
}

export async function getRepoStatuses(rootPath: string): Promise<GitRepoStatus[]> {
  const repoPaths = await findGitRepos(rootPath)
  const absoluteRoot = path.resolve(rootPath)

  const statuses: GitRepoStatus[] = []
  for (const repoRelPath of repoPaths) {
    const repoAbsPath = repoRelPath === '.' ? absoluteRoot : path.join(absoluteRoot, repoRelPath)
    const status = await getGitStatus(repoAbsPath)
    statuses.push({
      ...status,
      path: repoRelPath
    })
  }

  return statuses
}

export async function initGitRepo(rootPath: string): Promise<void> {
  const git = getGit(rootPath)
  await git.init()
}

export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.add([filePath])
}

export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  const git = getGit(repoPath)
  await git.reset(['HEAD', '--', filePath])
}

export async function commitGitChanges(repoPath: string, message: string): Promise<void> {
  const git = getGit(repoPath)
  await git.commit(message)
}

export async function getGitLog(repoPath: string): Promise<GitLogEntry[]> {
  const git = getGit(repoPath)
  const log = await git.log({ n: 5 })
  return log.all.map((entry) => ({
    hash: entry.hash,
    date: entry.date,
    message: entry.message,
    author_name: entry.author_name
  }))
}

export async function getGitDiff(repoPath: string, filePath: string): Promise<string> {
  const git = getGit(repoPath)
  const targetPath = getDiffFilePath(filePath)

  const diff = await git.diff(['HEAD', '--', targetPath])
  if (diff) {
    return diff
  }

  // For untracked new files, show the full content as an added diff.
  try {
    const absolutePath = path.join(repoPath, targetPath)
    const content = await fs.readFile(absolutePath, 'utf-8')
    return `--- /dev/null\n+++ ${targetPath}\n${content
      .split('\n')
      .map((line) => `+${line}`)
      .join('\n')}\n`
  } catch {
    return 'No diff available'
  }
}

export async function getGitBranches(repoPath: string): Promise<string[]> {
  const git = getGit(repoPath)
  const branches = await git.branchLocal()
  return branches.all
}

export async function checkoutGitBranch(repoPath: string, branchName: string): Promise<void> {
  const git = getGit(repoPath)
  await git.checkout(branchName)
}
