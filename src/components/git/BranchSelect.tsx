import { useState } from 'react'
import { GitBranch, ChevronDown, Check } from 'lucide-react'
import type { WorkspaceRoot } from '../../types/file'
import { gitClient } from '../../services/gitClient'

interface BranchSelectProps {
  root: WorkspaceRoot
  repoPath: string
  currentBranch: string | null
  onSwitch: () => void
}

export function BranchSelect({ root, repoPath, currentBranch, onSwitch }: BranchSelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleOpen = async (): Promise<void> => {
    if (open) {
      setOpen(false)
      return
    }

    if (root.type !== 'local' || !root.path) {
      window.alert('Only local repositories are supported')
      return
    }

    try {
      setLoading(true)
      const list = await gitClient.branches(root.path, repoPath)
      setBranches(list)
      setOpen(true)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (branchName: string): Promise<void> => {
    if (branchName === currentBranch) {
      setOpen(false)
      return
    }

    if (root.type !== 'local' || !root.path) {
      window.alert('Only local repositories are supported')
      return
    }

    try {
      setLoading(true)
      await gitClient.checkout(root.path, repoPath, branchName)
      setOpen(false)
      onSwitch()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to switch branch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        disabled={loading}
        className="flex items-center gap-1 rounded p-0.5 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        title="Switch branch"
      >
        <GitBranch size={12} className="text-purple-600" />
        <span className="max-w-[96px] truncate">{currentBranch || 'detached'}</span>
        <ChevronDown size={12} className="text-neutral-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-48 w-40 overflow-auto rounded border border-neutral-200 bg-white py-1 shadow-lg">
          {branches.length === 0 ? (
            <div className="px-2 py-1 text-xs text-neutral-400">No branches</div>
          ) : (
            branches.map((branch) => {
              const active = branch === currentBranch
              return (
                <button
                  key={branch}
                  onClick={() => void handleSelect(branch)}
                  className={`flex w-full items-center justify-between px-2 py-1 text-left text-xs hover:bg-neutral-50 ${
                    active ? 'font-medium text-blue-600' : 'text-neutral-700'
                  }`}
                >
                  <span className="truncate">{branch}</span>
                  {active && <Check size={12} />}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
