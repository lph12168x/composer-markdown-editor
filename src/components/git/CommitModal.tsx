import { useState } from 'react'
import type { WorkspaceRoot } from '../../types/file'
import { useGitStore } from '../../stores/gitStore'

interface CommitModalProps {
  root: WorkspaceRoot
  repoPath: string
  onClose: () => void
}

export function CommitModal({ root, repoPath, onClose }: CommitModalProps): JSX.Element {
  const { commit, loading } = useGitStore()
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (!message.trim()) {
      setError('Commit message is required')
      return
    }

    try {
      await commit(root, repoPath, message.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Commit Changes</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Commit Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              autoFocus
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Describe your changes..."
            />
          </div>

          {error && <div className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Committing...' : 'Commit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
