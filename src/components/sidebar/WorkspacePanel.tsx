import { useEffect, useState } from 'react'
import { FolderOpen, Server, Settings, Sun, Moon, X } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { settingsClient } from '../../services/settingsClient'
import type { ThemeSetting } from '../../types/ipc'
import { SshConnectModal } from '../modals/SshConnectModal'
import { SettingsModal } from '../modals/SettingsModal'

export function WorkspacePanel(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot, removeRoot, setActiveRoot } = useWorkspaceStore()
  const [showSshModal, setShowSshModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    let cancelled = false
    settingsClient
      .getTheme()
      .then((theme) => {
        if (cancelled) return
        const dark = theme === 'dark'
        setIsDark(dark)
        if (dark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      })
      .catch((err) => console.error('Failed to load theme:', err))
    return () => {
      cancelled = true
    }
  }, [])

  const handleToggleTheme = async (): Promise<void> => {
    const next: ThemeSetting = isDark ? 'light' : 'dark'
    setIsDark(next === 'dark')
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    await settingsClient.setTheme(next)
  }

  const handleOpenFolder = async (): Promise<void> => {
    const path = await fileSystemClient.openFolder()
    if (path) {
      addLocalRoot(path)
    }
  }

  return (
    <div className="border-b border-neutral-200 p-3 dark:border-neutral-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Workspace
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFolder}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title="Open folder"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={() => setShowSshModal(true)}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title="Connect SSH"
          >
            <Server size={16} />
          </button>
          <button
            onClick={() => void handleToggleTheme()}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="rounded p-1 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {workspace.roots.length === 0 ? (
        <div className="text-xs text-neutral-400 dark:text-neutral-500">No folders opened</div>
      ) : (
        <ul className="space-y-1">
          {workspace.roots.map((root) => (
            <li
              key={root.id}
              className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                activeRootId === root.id
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
              }`}
            >
              <button
                onClick={() => setActiveRoot(root.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                {root.type === 'ssh' ? (
                  <Server size={14} className="shrink-0 text-green-600" />
                ) : (
                  <FolderOpen size={14} className="shrink-0 text-blue-500" />
                )}
                <span className="truncate">{root.name}</span>
              </button>
              <button
                onClick={() => removeRoot(root.id)}
                className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                title="Remove root"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showSshModal && <SshConnectModal onClose={() => setShowSshModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
    </div>
  )
}
