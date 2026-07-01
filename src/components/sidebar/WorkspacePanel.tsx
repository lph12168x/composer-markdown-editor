import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Server, Settings, Sun, Moon, X } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useSshStore } from '../../stores/sshStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { settingsClient } from '../../services/settingsClient'
import type { RecentSshConnection, ThemeSetting } from '../../types/ipc'
import type { SshConnectionConfig } from '../../types/ssh'
import { SshConnectModal } from '../modals/SshConnectModal'
import { RemotePathPicker } from '../modals/RemotePathPicker'
import { SettingsModal } from '../modals/SettingsModal'

export function WorkspacePanel(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot, addSshRoot, removeRoot, setActiveRoot } = useWorkspaceStore()
  const { connect } = useSshStore()
  const [showSshModal, setShowSshModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [remotePickerHomePath, setRemotePickerHomePath] = useState<string | null>(null)
  const [menuReconnectConnection, setMenuReconnectConnection] = useState<RecentSshConnection | null>(null)
  const [sshError, setSshError] = useState<string | null>(null)
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

  const toConnectionConfig = (connection: RecentSshConnection): SshConnectionConfig => ({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    auth: connection.authType === 'key' ? 'privateKey' : connection.authType,
    privateKeyPath: connection.authType === 'key' ? connection.privateKeyPath : undefined
  })

  const handleDirectSshConnect = useCallback(async (connection: RecentSshConnection): Promise<void> => {
    setSshError(null)
    try {
      const status = await connect(toConnectionConfig(connection))
      setRemotePickerHomePath(status.homePath)
    } catch (err) {
      setSshError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }, [connect])

  const handleOpenFolder = async (): Promise<void> => {
    const path = await fileSystemClient.openFolder()
    if (path) {
      addLocalRoot(path)
    }
  }

  useEffect(() => {
    const handleMenuReconnect = (e: Event): void => {
      const connection = (e as CustomEvent).detail as RecentSshConnection
      if (!connection) return
      if (connection.authType === 'password') {
        setMenuReconnectConnection(connection)
      } else {
        void handleDirectSshConnect(connection)
      }
    }

    window.addEventListener('ssh:menu-reconnect', handleMenuReconnect)
    return () => window.removeEventListener('ssh:menu-reconnect', handleMenuReconnect)
  }, [handleDirectSshConnect])

  const handleSelectRemotePath = (selectedPath: string): void => {
    setRemotePickerHomePath(null)
    const name = selectedPath === '/' ? 'Remote Root' : selectedPath.split('/').pop() || selectedPath
    addSshRoot({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'ssh',
      name: `${name} (SSH)`,
      path: selectedPath
    })
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

      {sshError && (
        <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {sshError}
        </div>
      )}
      {showSshModal && (
        <SshConnectModal
          onClose={() => setShowSshModal(false)}
          onConnected={(homePath) => {
            setShowSshModal(false)
            setRemotePickerHomePath(homePath)
          }}
        />
      )}
      {menuReconnectConnection && (
        <SshConnectModal
          initialValues={menuReconnectConnection}
          onClose={() => setMenuReconnectConnection(null)}
          onConnected={(homePath) => {
            setMenuReconnectConnection(null)
            setRemotePickerHomePath(homePath)
          }}
        />
      )}
      {remotePickerHomePath && (
        <RemotePathPicker
          defaultPath={remotePickerHomePath}
          onSelect={handleSelectRemotePath}
          onClose={() => setRemotePickerHomePath(null)}
        />
      )}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onOpenRemoteFolder={(homePath) => {
            setShowSettingsModal(false)
            setRemotePickerHomePath(homePath)
          }}
        />
      )}
    </div>
  )
}
