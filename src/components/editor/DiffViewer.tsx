import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { gitClient } from '../../services/gitClient'
import { useUiStore } from '../../stores/uiStore'

function getLineClass(line: string): string {
  if (line.startsWith('@@')) {
    return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
  }
  if (
    line.startsWith('---') ||
    line.startsWith('+++') ||
    line.startsWith('diff ') ||
    line.startsWith('index ')
  ) {
    return 'text-neutral-500 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-800'
  }
  if (line.startsWith('+')) {
    return 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
  }
  if (line.startsWith('-')) {
    return 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
  }
  return 'text-neutral-700 dark:text-neutral-300'
}

export function DiffViewer(): JSX.Element {
  const { diffTarget, closeDiff } = useUiStore()
  const [diff, setDiff] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      if (!diffTarget) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const text = await gitClient.diff(
          diffTarget.root,
          diffTarget.repoPath,
          diffTarget.filePath
        )
        if (!cancelled) {
          setDiff(text)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load diff')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [diffTarget])

  const filePath = diffTarget?.filePath ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Diff
          </span>
          <span className="ml-2 truncate text-xs text-neutral-700 dark:text-neutral-300" title={filePath}>
            {filePath}
          </span>
        </div>
        <button
          onClick={closeDiff}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="Close diff"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-white p-4 dark:bg-neutral-900">
        {loading && <div className="text-xs text-neutral-400 dark:text-neutral-500">Loading diff…</div>}
        {error && <div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</div>}
        {!loading && !error && (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5">
            {diff.split('\n').map((line, index) => (
              <div key={index} className={`px-1 ${getLineClass(line)}`}>
                {line || ' '}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}
