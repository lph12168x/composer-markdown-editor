import type { GitChange, GitLogEntry, GitRepoStatus } from '../../types/git'
import { sshConnectionManager } from '../ssh/sshClient'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function joinCommands(...commands: string[]): string {
  return commands.join(' && ')
}

function remoteRepoCommand(repoPath: string, ...gitArgs: string[]): string {
  const cd = `cd ${shellQuote(repoPath)}`
  const git = `git ${gitArgs.join(' ')}`
  return joinCommands(cd, git)
}

async function execGit(repoPath: string, ...gitArgs: string[]): Promise<string> {
  const command = remoteRepoCommand(repoPath, ...gitArgs)
  const { stdout, stderr, code } = await sshConnectionManager.execCommand(command)
  if (code !== 0) {
    throw new Error(stderr.trim() || `Git command failed with code ${code}`)
  }
  return stdout
}

const MAX_SCAN_DEPTH = 3

export async function findGitRepos(rootPath: string): Promise<string[]> {
  const findCmd = `find ${shellQuote(rootPath)} -maxdepth ${MAX_SCAN_DEPTH} -type d -name .git 2>/dev/null`
  const { stdout } = await sshConnectionManager.execCommand(findCmd)

  const repos: string[] = []
  const lines = stdout.split('\n').filter(Boolean)

  for (const line of lines) {
    const parent = line.replace(/\/\.git$/, '')
    if (parent === rootPath) {
      if (!repos.includes('.')) {
        repos.push('.')
      }
    } else {
      const rel = parent.slice(rootPath.length).replace(/^\/+/, '')
      if (rel && !repos.includes(rel)) {
        repos.push(rel)
      }
    }
  }

  return repos
}

function parsePorcelainStatus(stdout: string): {
  branch: string | null
  ahead: number
  behind: number
  changes: GitChange[]
} {
  const lines = stdout.split('\n').filter(Boolean)
  let branch: string | null = null
  let ahead = 0
  let behind = 0
  const changes: GitChange[] = []

  const pushChange = (path: string, status: GitChange['status']) => {
    changes.push({ path, status })
  }

  for (const line of lines) {
    if (line.startsWith('##')) {
      const branchInfo = line.slice(3)
      const match = branchInfo.match(/^([^\.\s]+)(\.\.\.([^\[]+))?\s*(\[([^\]]+)\])?/)
      if (match) {
        branch = match[1] || null
        const tracking = match[3]
        const status = match[5]
        if (status) {
          const aheadMatch = status.match(/ahead\s+(\d+)/)
          const behindMatch = status.match(/behind\s+(\d+)/)
          if (aheadMatch) ahead = parseInt(aheadMatch[1], 10)
          if (behindMatch) behind = parseInt(behindMatch[1], 10)
        }
        if (!tracking && branch === 'HEAD') {
          branch = null
        }
      }
      continue
    }

    const indexStatus = line[0]
    const workTreeStatus = line[1]
    const rest = line.slice(3)

    if (indexStatus === 'R') {
      const [from, to] = rest.split(' -> ')
      pushChange(`${from} -> ${to}`, 'renamed')
    } else if (indexStatus !== ' ' && indexStatus !== '?') {
      pushChange(rest, 'staged')
    }

    if (workTreeStatus === 'R') {
      const [from, to] = rest.split(' -> ')
      pushChange(`${from} -> ${to}`, 'renamed')
    } else if (workTreeStatus !== ' ' && workTreeStatus !== undefined) {
      switch (workTreeStatus) {
        case 'A':
        case '?':
          pushChange(rest, 'added')
          break
        case 'D':
          pushChange(rest, 'deleted')
          break
        case 'M':
        default:
          pushChange(rest, 'modified')
      }
    }
  }

  return { branch, ahead, behind, changes }
}

export async function getGitStatus(repoPath: string): Promise<Omit<GitRepoStatus, 'path'>> {
  const isRepoCheck = await sshConnectionManager.execCommand(
    remoteRepoCommand(repoPath, 'rev-parse', '--is-inside-work-tree')
  )
  if (isRepoCheck.code !== 0 || isRepoCheck.stdout.trim() !== 'true') {
    return {
      isRepo: false,
      branch: null,
      ahead: 0,
      behind: 0,
      changes: [],
      history: []
    }
  }

  const [statusOut, logOut] = await Promise.all([
    execGit(repoPath, 'status', '--porcelain=v1', '-b'),
    execGit(repoPath, 'log', '-n', '5', `--format=%H%x1f%ai%x1f%an%x1f%s`)
  ])

  const { branch, ahead, behind, changes } = parsePorcelainStatus(statusOut)

  const history: GitLogEntry[] = logOut
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author_name, ...messageParts] = line.split('\x1f')
      return {
        hash: hash || '',
        date: date || '',
        author_name: author_name || '',
        message: messageParts.join('\x1f')
      }
    })

  return {
    isRepo: true,
    branch,
    ahead,
    behind,
    changes,
    history
  }
}

export async function getRepoStatuses(rootPath: string): Promise<GitRepoStatus[]> {
  const repoPaths = await findGitRepos(rootPath)
  const statuses: GitRepoStatus[] = []

  for (const repoRelPath of repoPaths) {
    const repoAbsPath = repoRelPath === '.' ? rootPath : `${rootPath}/${repoRelPath}`
    const status = await getGitStatus(repoAbsPath)
    statuses.push({ ...status, path: repoRelPath })
  }

  return statuses
}

export async function initGitRepo(rootPath: string): Promise<void> {
  await execGit(rootPath, 'init')
}

export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  await execGit(repoPath, 'add', '--', shellQuote(filePath))
}

export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  await execGit(repoPath, 'reset', 'HEAD', '--', shellQuote(filePath))
}

export async function commitGitChanges(repoPath: string, message: string): Promise<void> {
  await execGit(repoPath, 'commit', '-m', shellQuote(message))
}

export async function getGitLog(repoPath: string): Promise<GitLogEntry[]> {
  const out = await execGit(repoPath, 'log', '-n', '5', `--format=%H%x1f%ai%x1f%an%x1f%s`)
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author_name, ...messageParts] = line.split('\x1f')
      return {
        hash: hash || '',
        date: date || '',
        author_name: author_name || '',
        message: messageParts.join('\x1f')
      }
    })
}

function getDiffFilePath(filePath: string): string {
  if (filePath.includes(' -> ')) {
    return filePath.split(' -> ').pop() ?? filePath
  }
  return filePath
}

export async function getGitDiff(repoPath: string, filePath: string): Promise<string> {
  const targetPath = getDiffFilePath(filePath)
  const diff = await execGit(repoPath, 'diff', 'HEAD', '--', shellQuote(targetPath))
  if (diff) {
    return diff
  }

  // For untracked new files, show the full content as an added diff.
  const fullPath = `${repoPath}/${targetPath}`
  const sftp = await sshConnectionManager.getSftp()
  return new Promise((resolve, reject) => {
    sftp.readFile(fullPath, 'utf-8', (err, data) => {
      if (err) {
        reject(new Error('No diff available'))
        return
      }
      const content = data?.toString() ?? ''
      resolve(
        `--- /dev/null\n+++ ${targetPath}\n${content
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n')}\n`
      )
    })
  })
}

export async function getGitBranches(repoPath: string): Promise<string[]> {
  const out = await execGit(repoPath, 'branch', `--format=%(refname:short)`)
  return out.split('\n').filter(Boolean)
}

export async function checkoutGitBranch(repoPath: string, branchName: string): Promise<void> {
  await execGit(repoPath, 'checkout', shellQuote(branchName))
}
