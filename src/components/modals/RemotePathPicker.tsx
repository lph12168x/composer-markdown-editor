import { useEffect, useState } from 'react'
import { ChevronLeft, Folder, Check, X } from 'lucide-react'
import { posixBasename, posixDirname, posixJoin } from '../../utils/path'
import type { FileRef, WorkspaceRoot } from '../../types/file'
import { fileSystemClient } from '../../services/fileSystemClient'

interface RemotePathPickerProps {
  defaultPath?: string
  onSelect: (selectedPath: string) => void
  onClose: () => void
}

export function RemotePathPicker({ defaultPath = '/', onSelect, onClose }: RemotePathPickerProps): JSX.Element {
  const [currentPath, setCurrentPath] = useState(defaultPath)
  const [entries, setEntries] = useState<FileRef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false

    const root: WorkspaceRoot = {
      id: 'ssh-picker',
      type: 'ssh',
      name: 'Remote',
      path: currentPath
    }
    const ref: FileRef = {
      id: `ssh-picker:${currentPath}`,
      rootId: 'ssh-picker',
      type: 'ssh',
      path: currentPath,
      name: posixBasename(currentPath) || currentPath,
      isDirectory: true
    }

    setLoading(true)
    setError(null)

    fileSystemClient
      .readDir(root, ref)
      .then((all) => {
        if (cancelled) return
        const dirs = all.filter((e) => e.isDirectory).sort((a, b) => a.name.localeCompare(b.name))
        setEntries(dirs)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to list remote directory')
        setEntries([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentPath])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleEnter = (dirName: string): void => {
    setCurrentPath(posixJoin(currentPath, dirName))
  }

  const handleGoUp = (): void => {
    const parent = posixDirname(currentPath)
    if (parent && parent !== currentPath) {
      setCurrentPath(parent)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white p-4 shadow-lg dark:bg-neutral-800 dark:text-white">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Open Remote Folder</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={handleGoUp}
            disabled={currentPath === '/'}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-700"
            title="Go up"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 truncate rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
            {currentPath}
          </div>
          <button
            onClick={() => onSelect(currentPath)}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            <Check size={14} />
            Select
          </button>
        </div>

        <div className="flex-1 overflow-auto rounded border border-neutral-200 dark:border-neutral-700">
          {loading && <div className="p-4 text-sm text-neutral-400">Loading…</div>}
          {error && <div className="p-4 text-sm text-red-600">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="p-4 text-sm text-neutral-400">No subdirectories</div>
          )}
          {!loading && !error && (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    onClick={() => handleEnter(entry.name)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Folder size={16} className="text-blue-500" />
                    <span className="flex-1 truncate">{entry.name}</span>
                    <span className="text-xs text-neutral-400">Open</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Open This Folder
          </button>
        </div>
      </div>
    </div>
  )
}
