import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Check, FileText, Trash2, ArrowRightLeft, ChevronDown, ChevronRight } from 'lucide-react'
import type { WorkspaceRoot } from '../../types/file'
import type { GitLogEntry } from '../../types/git'
import { useGitStore } from '../../stores/gitStore'
import { useUiStore } from '../../stores/uiStore'
import { CommitModal } from './CommitModal'
import { BranchSelect } from './BranchSelect'

interface GitPanelProps {
  root: WorkspaceRoot
}

function getChangeIcon(status: string): JSX.Element {
  switch (status) {
    case 'staged':
      return <Check size={12} className="text-green-600" />
    case 'added':
      return <Plus size={12} className="text-blue-600" />
    case 'deleted':
      return <Trash2 size={12} className="text-red-600" />
    case 'renamed':
      return <ArrowRightLeft size={12} className="text-purple-600" />
    default:
      return <FileText size={12} className="text-amber-600" />
  }
}

function getChangeLabel(status: string): string {
  switch (status) {
    case 'staged':
      return 'staged'
    case 'added':
      return 'new'
    case 'deleted':
      return 'deleted'
    case 'renamed':
      return 'renamed'
    default:
      return 'modified'
  }
}

function formatRepoPath(repoPath: string): string {
  return repoPath === '.' ? '@ root' : `@ ${repoPath}`
}

function formatLogDate(date: string): string {
  try {
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return date
  }
}

export function GitPanel({ root }: GitPanelProps): JSX.Element {
  const { repos, loading, error, loadStatus, initRepo, stage, unstage } = useGitStore()
  const { openDiff } = useUiStore()
  const [expanded, setExpanded] = useState(true)
  const [commitTarget, setCommitTarget] = useState<string | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadStatus(root)
  }, [root, loadStatus])

  const handleInit = async (): Promise<void> => {
    try {
      await initRepo(root)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to initialize repository')
    }
  }

  const handleToggleStage = async (repoPath: string, filePath: string, isStaged: boolean): Promise<void> => {
    try {
      if (isStaged) {
        await unstage(root, repoPath, filePath)
      } else {
        await stage(root, repoPath, filePath)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to toggle stage')
    }
  }

  return (
    <div className="border-t border-neutral-200 p-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mb-2 flex w-full items-center justify-between"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Git</span>
        {expanded ? (
          <ChevronDown size={14} className="text-neutral-500" />
        ) : (
          <ChevronRight size={14} className="text-neutral-500" />
        )}
      </button>

      {!expanded && (
        <div className="text-xs text-neutral-400">
          {repos.length} {repos.length === 1 ? 'repo' : 'repos'}
        </div>
      )}

      {expanded && (
        <>
          <div className="mb-2 flex items-center justify-end gap-1">
            <button
              onClick={() => loadStatus(root)}
              disabled={loading}
              className="rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
              title="Refresh Git status"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {error && <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>}

          {repos.length === 0 && !error && (
            <div className="space-y-2">
              <div className="text-xs text-neutral-400">No Git repositories found</div>
              <button
                onClick={handleInit}
                disabled={loading}
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Initialize repository here
              </button>
            </div>
          )}

          <div className="space-y-3">
            {repos.map((repo) => {
              const stagedCount = repo.changes.filter((c) => c.status === 'staged').length
              return (
                <div key={repo.path} className="rounded border border-neutral-200 p-2">
                  <div className="mb-1 flex items-center gap-2 text-sm text-neutral-700">
                    <BranchSelect
                      root={root}
                      repoPath={repo.path}
                      currentBranch={repo.branch}
                      onSwitch={() => loadStatus(root)}
                    />
                    <span className="text-xs text-neutral-400">{formatRepoPath(repo.path)}</span>
                    {(repo.ahead > 0 || repo.behind > 0) && (
                      <span className="text-xs text-neutral-400">
                        {repo.ahead > 0 ? `↑${repo.ahead}` : ''}
                        {repo.behind > 0 ? `↓${repo.behind}` : ''}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setHistoryExpanded((prev) => ({
                          ...prev,
                          [repo.path]: !prev[repo.path]
                        }))
                      }
                      className="ml-auto flex items-center gap-1 rounded p-0.5 text-xs text-neutral-500 hover:bg-neutral-100"
                      title="Toggle commit history"
                    >
                      {historyExpanded[repo.path] ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      history
                    </button>
                  </div>

                  {historyExpanded[repo.path] && (
                    <div className="mb-2 max-h-32 overflow-auto rounded bg-neutral-50 p-1.5">
                      {repo.history.length === 0 ? (
                        <div className="text-xs text-neutral-400">No recent commits</div>
                      ) : (
                        <ul className="space-y-1.5">
                          {repo.history.map((entry: GitLogEntry) => (
                            <li key={entry.hash} className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-neutral-400">
                                  {entry.hash.slice(0, 7)}
                                </span>
                                <span className="flex-1 truncate font-medium text-neutral-700" title={entry.message}>
                                  {entry.message.split('\n')[0]}
                                </span>
                              </div>
                              <div className="ml-7 text-[10px] text-neutral-400">
                                {entry.author_name} · {formatLogDate(entry.date)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {repo.changes.length === 0 ? (
                    <div className="text-xs text-neutral-400">No changes</div>
                  ) : (
                    <ul className="mb-2 max-h-32 space-y-1 overflow-auto">
                      {repo.changes.map((change) => {
                        const isStaged = change.status === 'staged'
                        const isRenamed = change.status === 'renamed'
                        return (
                          <li
                            key={change.path}
                            className="flex items-center gap-1.5 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={isStaged}
                              disabled={loading || isRenamed}
                              onChange={() => handleToggleStage(repo.path, change.path, isStaged)}
                              title={isRenamed ? 'Renamed files cannot be toggled individually' : isStaged ? 'Unstage' : 'Stage'}
                              className="h-3 w-3 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            {getChangeIcon(change.status)}
                            <span className="flex-1 truncate text-neutral-700" title={change.path}>
                              {change.path}
                            </span>
                            <button
                              onClick={() =>
                                openDiff({
                                  rootPath: root.path || '',
                                  repoPath: repo.path,
                                  filePath: change.path
                                })
                              }
                              className="shrink-0 rounded px-1 text-[10px] text-blue-600 hover:bg-blue-50"
                            >
                              Diff
                            </button>
                            <span className="shrink-0 rounded bg-neutral-100 px-1 text-[10px] uppercase text-neutral-500">
                              {getChangeLabel(change.status)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <button
                    onClick={() => setCommitTarget(repo.path)}
                    disabled={loading || stagedCount === 0}
                    className="w-full rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Commit Staged
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {commitTarget && (
        <CommitModal root={root} repoPath={commitTarget} onClose={() => setCommitTarget(null)} />
      )}
    </div>
  )
}
