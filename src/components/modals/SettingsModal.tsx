import { useEffect, useState } from 'react'
import { X, Trash2, Server } from 'lucide-react'
import { settingsClient } from '../../services/settingsClient'
import type { RecentSshConnection } from '../../types/ipc'
import { SshConnectModal } from './SshConnectModal'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps): JSX.Element {
  const [recentConnections, setRecentConnections] = useState<RecentSshConnection[]>([])
  const [reconnectConnection, setReconnectConnection] = useState<RecentSshConnection | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      const connections = await settingsClient.listRecentConnections()
      if (cancelled) return
      setRecentConnections(connections)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleRemoveConnection = async (connection: RecentSshConnection): Promise<void> => {
    await settingsClient.removeRecentConnection(connection.host, connection.username)
    setRecentConnections((prev) =>
      prev.filter((c) => !(c.host === connection.host && c.username === connection.username))
    )
  }

  const handleClearConnections = async (): Promise<void> => {
    await Promise.all(
      recentConnections.map((c) => settingsClient.removeRecentConnection(c.host, c.username))
    )
    setRecentConnections([])
  }

  const handleReconnect = (connection: RecentSshConnection): void => {
    setReconnectConnection(connection)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white p-6 shadow-lg dark:bg-neutral-800 dark:text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Settings</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-auto pr-2">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Recent SSH Connections
              </h3>
              {recentConnections.length > 0 && (
                <button
                  onClick={handleClearConnections}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>
            {recentConnections.length === 0 ? (
              <div className="text-sm text-neutral-400 dark:text-neutral-500">
                No recent SSH connections
              </div>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-auto rounded border border-neutral-200 p-2 dark:border-neutral-700">
                {recentConnections.map((conn) => (
                  <li
                    key={`${conn.username}@${conn.host}:${conn.port}`}
                    className="flex items-center justify-between text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <button
                      onClick={() => handleReconnect(conn)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      title="Reconnect"
                    >
                      <Server size={14} className="shrink-0 text-green-600" />
                      <span className="truncate">
                        {conn.username}@{conn.host}:{conn.port}
                      </span>
                      <span className="rounded bg-neutral-100 px-1 text-[10px] uppercase text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400">
                        {conn.authType}
                      </span>
                    </button>
                    <button
                      onClick={() => handleRemoveConnection(conn)}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-700"
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>

      {reconnectConnection && (
        <SshConnectModal
          initialValues={reconnectConnection}
          onClose={() => setReconnectConnection(null)}
        />
      )}
    </div>
  )
}
