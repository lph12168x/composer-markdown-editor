import { FolderOpen, X } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { fileSystemClient } from '../../services/fileSystemClient'

export function WorkspacePanel(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot, removeRoot, setActiveRoot } = useWorkspaceStore()

  const handleOpenFolder = async (): Promise<void> => {
    const path = await fileSystemClient.openFolder()
    if (path) {
      addLocalRoot(path)
    }
  }

  return (
    <div className="border-b border-neutral-700 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Workspace
        </span>
        <button
          onClick={handleOpenFolder}
          className="rounded p-1 hover:bg-neutral-700"
          title="Open folder"
        >
          <FolderOpen size={16} />
        </button>
      </div>

      {workspace.roots.length === 0 ? (
        <div className="text-xs text-neutral-500">No folders opened</div>
      ) : (
        <ul className="space-y-1">
          {workspace.roots.map((root) => (
            <li
              key={root.id}
              className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                activeRootId === root.id ? 'bg-neutral-700' : 'hover:bg-neutral-750'
              }`}
            >
              <button
                onClick={() => setActiveRoot(root.id)}
                className="flex flex-1 items-center gap-2 truncate text-left"
              >
                <FolderOpen size={14} className="shrink-0 text-blue-400" />
                <span className="truncate">{root.name}</span>
              </button>
              <button
                onClick={() => removeRoot(root.id)}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
                title="Remove root"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
