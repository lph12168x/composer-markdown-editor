import { useState } from 'react'
import type { SshAuthMethod, SshConnectionConfig } from '../../types/ssh'
import { useSshStore } from '../../stores/sshStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import type { RecentSshConnection } from '../../types/ipc'

interface SshConnectModalProps {
  onClose: () => void
  initialValues?: Partial<RecentSshConnection>
}

export function SshConnectModal({ onClose, initialValues }: SshConnectModalProps): JSX.Element {
  const { connect, isConnecting, error } = useSshStore()
  const { addSshRoot } = useWorkspaceStore()

  const [host, setHost] = useState(initialValues?.host ?? '')
  const [port, setPort] = useState(initialValues?.port?.toString() ?? '22')
  const [username, setUsername] = useState(initialValues?.username ?? '')
  const [auth, setAuth] = useState<SshAuthMethod>(
    initialValues?.authType === 'key' ? 'privateKey' : initialValues?.authType ?? 'password'
  )
  const [password, setPassword] = useState('')
  const [privateKeyPath, setPrivateKeyPath] = useState(initialValues?.privateKeyPath ?? '')
  const [passphrase, setPassphrase] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSelectKey = async (): Promise<void> => {
    const path = await fileSystemClient.openFile()
    if (path) {
      setPrivateKeyPath(path)
    }
  }

  const validate = (): boolean => {
    if (!host.trim()) {
      setFormError('Host is required')
      return false
    }
    if (!username.trim()) {
      setFormError('Username is required')
      return false
    }
    const portNum = parseInt(port, 10)
    if (Number.isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setFormError('Port must be between 1 and 65535')
      return false
    }
    if (auth === 'password' && !password) {
      setFormError('Password is required')
      return false
    }
    if (auth === 'privateKey' && !privateKeyPath) {
      setFormError('Private key is required')
      return false
    }
    setFormError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!validate()) return

    const config: SshConnectionConfig = {
      host: host.trim(),
      port: parseInt(port, 10),
      username: username.trim(),
      auth,
      password: auth === 'password' ? password : undefined,
      privateKeyPath: auth === 'privateKey' ? privateKeyPath : undefined,
      passphrase: auth === 'privateKey' ? passphrase || undefined : undefined
    }

    try {
      const status = await connect(config)
      const rootId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      addSshRoot({
        id: rootId,
        type: 'ssh',
        name: `${config.username}@${config.host}`,
        path: status.homePath,
        connectionId: rootId
      })
      onClose()
    } catch {
      // error is already stored in sshStore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Connect to SSH Server</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Port</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Authentication</label>
            <select
              value={auth}
              onChange={(e) => setAuth(e.target.value as SshAuthMethod)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="password">Password</option>
              <option value="privateKey">Private Key</option>
              <option value="agent">SSH Agent</option>
            </select>
          </div>

          {auth === 'password' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {auth === 'privateKey' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Private Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    placeholder="~/.ssh/id_rsa"
                    className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSelectKey}
                    className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                  >
                    Browse
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Passphrase (optional)</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {(formError || error) && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">{formError || error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isConnecting}
              className="rounded px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isConnecting}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
