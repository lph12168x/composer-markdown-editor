import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Server, Settings, Sun, Moon, X } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useFileTreeStore } from '../../stores/fileStore'
import { useSshStore } from '../../stores/sshStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { settingsClient } from '../../services/settingsClient'
import type { RecentSshConnection, ThemeSetting } from '../../types/ipc'
import type { SshConnectionConfig } from '../../types/ssh'
import type { FileRef, WorkspaceRoot } from '../../types/file'
import { posixBasename, posixDirname } from '../../utils/path'
import { SshConnectModal } from '../modals/SshConnectModal'
import { RemotePathPicker } from '../modals/RemotePathPicker'
import { RemoteFilePicker } from '../modals/RemoteFilePicker'
import { SettingsModal } from '../modals/SettingsModal'
import { SshReconnectContext, type SshReconnectApi } from './sshReconnect'

export function WorkspacePanel(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot, addSshRoot, removeRoot, setActiveRoot } = useWorkspaceStore()
  const { connect, isConnected } = useSshStore()
  const [showSshModal, setShowSshModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [remotePickerHomePath, setRemotePickerHomePath] = useState<string | null>(null)
  const [remoteFilePickerPath, setRemoteFilePickerPath] = useState<string | null>(null)
  const [pendingConnection, setPendingConnection] = useState<RecentSshConnection | null>(null)
  const [sshHomePath, setSshHomePath] = useState<string | null>(null)
  const [sshError, setSshError] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  // Drives the `SshConnectModal` opened in two different flows:
  //  1. The application menu emits `ssh:menu-reconnect` and we want to
  //     surface a password prompt so the user lands back in the picker.
  //  2. Descendants (`FileTree`, `TreeNode`) request an automatic
  //     reconnect via the `SshReconnectContext`. They await the promise
  //     we hold in `resolve` / `reject` so they can re-issue their
  //     original `getChildren` / `refreshNode` call once the connection
  //     is back up.
  const [reconnectState, setReconnectState] = useState<{
    connection: RecentSshConnection
    onConnected: () => void
    onCancel: () => void
  } | null>(null)

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

  const toRecentConnection = (config: SshConnectionConfig): RecentSshConnection => ({
    host: config.host,
    port: config.port,
    username: config.username,
    authType: config.auth === 'privateKey' ? 'key' : config.auth,
    privateKeyPath: config.auth === 'privateKey' ? config.privateKeyPath : undefined
  })

  const handleSelectRemotePath = useCallback(
    (selectedPath: string, connection?: RecentSshConnection): void => {
      setRemotePickerHomePath(null)
      const conn = connection || pendingConnection
      if (conn) {
        void settingsClient.addRecentConnection({ ...conn, lastPath: selectedPath })
        setPendingConnection(null)
      }

      const existingRoot = useWorkspaceStore.getState().workspace.roots.find(
        (r) => r.type === 'ssh' && r.path === selectedPath
      )
      if (existingRoot) {
        useFileTreeStore.getState().clearTree(existingRoot.id)
        setActiveRoot(existingRoot.id)
        return
      }

      const name = selectedPath === '/' ? 'Remote Root' : selectedPath.split('/').pop() || selectedPath
      addSshRoot({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: 'ssh',
        name: `${name} (SSH)`,
        path: selectedPath,
        host: conn?.host,
        username: conn?.username
      })
    },
    [addSshRoot, pendingConnection, setActiveRoot]
  )

  const openRemoteFolderPicker = useCallback(async (): Promise<void> => {
    let conn = pendingConnection
    if (!conn) {
      const { host, username } = useSshStore.getState()
      if (host && username) {
        const connections = await settingsClient.listRecentConnections()
        conn = connections.find((c) => c.host === host && c.username === username) || null
      }
    }
    setRemotePickerHomePath(conn?.lastPath || sshHomePath || '/')
  }, [pendingConnection, sshHomePath])

  const openRemoteFilePicker = useCallback(async (): Promise<void> => {
    let conn = pendingConnection
    if (!conn) {
      const { host, username } = useSshStore.getState()
      if (host && username) {
        const connections = await settingsClient.listRecentConnections()
        conn = connections.find((c) => c.host === host && c.username === username) || null
      }
    }
    const basePath = conn?.lastPath || sshHomePath || '/'
    setRemoteFilePickerPath(posixDirname(basePath))
  }, [pendingConnection, sshHomePath])

  const handleSelectRemoteFile = useCallback(
    (selectedPath: string): void => {
      setRemoteFilePickerPath(null)
      const ref: FileRef = {
        id: `ssh-drop:${selectedPath}`,
        rootId: 'ssh-drop',
        type: 'ssh',
        path: selectedPath,
        name: posixBasename(selectedPath),
        isDirectory: false
      }
      window.dispatchEvent(new CustomEvent('file:open', { detail: ref }))
    },
    []
  )

  const handleDirectSshConnect = useCallback(async (connection: RecentSshConnection): Promise<void> => {
    setSshError(null)
    try {
      const status = await connect(toConnectionConfig(connection))
      setPendingConnection(connection)
      setSshHomePath(status.homePath)
      setRemotePickerHomePath(connection.lastPath || status.homePath)
    } catch (err) {
      setSshError(err instanceof Error ? err.message : 'Failed to connect')
      setPendingConnection(null)
      setSshHomePath(null)
    }
  }, [connect])

  /**
   * Look up the saved `RecentSshConnection` matching a workspace root by
   * host + username. Workspace roots only carry `host` / `username` /
   * `path`, so we always resolve through the recent-connections list
   * rather than caching anything on the root itself.
   */
  const findConnectionForRoot = useCallback(
    async (root: WorkspaceRoot): Promise<RecentSshConnection | null> => {
      if (root.type !== 'ssh') return null
      const connections = await settingsClient.listRecentConnections()
      return (
        connections.find(
          (c) => c.host === root.host && c.username === root.username
        ) ?? null
      )
    },
    []
  )

  /**
   * Make sure SSH is connected before the caller does any SFTP I/O. Used
   * by `FileTree` and `TreeNode` so the previously-opened remote folders
   * remain clickable across restarts without forcing the user to re-pick
   * the path. If a connection is already up we return immediately.
   * Otherwise we look up the saved credentials and prompt for the
   * password via `SshConnectModal`; the returned promise resolves once
   * the connection succeeds and rejects on cancel.
   */
  const ensureSshConnected = useCallback(
    async (connection?: RecentSshConnection | null): Promise<void> => {
      if (useSshStore.getState().isConnected) return

      let conn = connection ?? null
      if (!conn) {
        const { host, username } = useSshStore.getState()
        if (host && username) {
          const connections = await settingsClient.listRecentConnections()
          conn =
            connections.find(
              (c) => c.host === host && c.username === username
            ) ?? null
        }
      }

      if (!conn) {
        throw new Error(
          'No saved SSH connection found for this workspace. Connect manually first.'
        )
      }

      return new Promise<void>((resolve, reject) => {
        setReconnectState({
          connection: conn,
          onConnected: () => resolve(),
          onCancel: () =>
            reject(new Error('SSH re-authentication was cancelled'))
        })
      })
    },
    []
  )

  const sshReconnectApi = useMemo<SshReconnectApi>(
    () => ({ ensureSshConnected, findConnectionForRoot }),
    [ensureSshConnected, findConnectionForRoot]
  )

  const handleOpenFolder = useCallback(async (): Promise<void> => {
    if (isConnected) {
      await openRemoteFolderPicker()
    } else {
      const path = await fileSystemClient.openFolder()
      if (path) {
        addLocalRoot(path)
      }
    }
  }, [isConnected, addLocalRoot, openRemoteFolderPicker])

  useEffect(() => {
    const handleMenuReconnect = (e: Event): void => {
      const connection = (e as CustomEvent).detail as RecentSshConnection
      if (!connection) return
      if (connection.authType === 'password') {
        // Funnel the menu-triggered reconnect through the same modal the
        // tree uses — keep one source of truth for "show the password
        // prompt". We don't promise anything to the caller; the menu
        // handler will re-trigger its picker via `onConnected` below.
        setReconnectState({
          connection,
          onConnected: () => {
            setPendingConnection(connection)
            setRemotePickerHomePath(connection.lastPath || null)
          },
          onCancel: () => {
            // Menu-triggered modal: cancel just dismisses it. Nothing to
            // resolve or reject because we don't expose a promise.
          }
        })
      } else {
        void handleDirectSshConnect(connection)
      }
    }

    window.addEventListener('ssh:menu-reconnect', handleMenuReconnect)
    return () => window.removeEventListener('ssh:menu-reconnect', handleMenuReconnect)
  }, [handleDirectSshConnect])

  useEffect(() => {
    const handleOpenRemoteFolder = async (): Promise<void> => {
      const { isConnected: connected } = useSshStore.getState()
      if (connected) {
        await openRemoteFolderPicker()
      }
    }
    window.addEventListener('ssh:open-folder', handleOpenRemoteFolder)
    return () => window.removeEventListener('ssh:open-folder', handleOpenRemoteFolder)
  }, [openRemoteFolderPicker])

  useEffect(() => {
    const handleOpenRemoteFile = async (): Promise<void> => {
      const { isConnected: connected } = useSshStore.getState()
      if (connected) {
        await openRemoteFilePicker()
      }
    }
    window.addEventListener('ssh:open-file', handleOpenRemoteFile)
    return () => window.removeEventListener('ssh:open-file', handleOpenRemoteFile)
  }, [openRemoteFilePicker])

  return (
    <SshReconnectContext.Provider value={sshReconnectApi}>
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
                onClick={() => {
                  setActiveRoot(root.id)
                  // For SSH roots, attempt an automatic reconnect. The
                  // FileTree mounted for this root will call
                  // `ensureSshConnected` itself on mount, but doing it here
                  // too means the user gets the password prompt immediately
                  // rather than only after they click the chevron.
                  if (root.type === 'ssh' && !useSshStore.getState().isConnected) {
                    void findConnectionForRoot(root)
                      .then((conn) => ensureSshConnected(conn))
                      .catch((err) => {
                        console.error('SSH reconnect on root click failed:', err)
                      })
                  }
                }}
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
          onConnected={(homePath, config) => {
            setShowSshModal(false)
            const conn = toRecentConnection(config)
            setPendingConnection(conn)
            setSshHomePath(homePath)
            setRemotePickerHomePath(homePath)
          }}
        />
      )}
      {reconnectState && (
        <SshConnectModal
          initialValues={reconnectState.connection}
          onClose={() => {
            // Capture the callbacks before clearing state so the cancel
            // handler fires after the modal disappears.
            const cancel = reconnectState.onCancel
            setReconnectState(null)
            cancel()
          }}
          onConnected={(homePath, _config) => {
            const connected = reconnectState.onConnected
            setReconnectState(null)
            setSshHomePath(homePath)
            connected()
          }}
        />
      )}
      {remotePickerHomePath && (
        <RemotePathPicker
          defaultPath={remotePickerHomePath}
          onSelect={handleSelectRemotePath}
          onClose={() => {
            setRemotePickerHomePath(null)
            setPendingConnection(null)
          }}
        />
      )}
      {remoteFilePickerPath && (
        <RemoteFilePicker
          defaultPath={remoteFilePickerPath}
          onSelect={handleSelectRemoteFile}
          onClose={() => setRemoteFilePickerPath(null)}
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
    </SshReconnectContext.Provider>
  )
}
