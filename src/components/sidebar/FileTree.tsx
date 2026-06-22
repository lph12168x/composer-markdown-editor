import { useCallback, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import type { FileRef, WorkspaceRoot } from '../../types/file'
import { useFileTreeStore } from '../../stores/fileStore'
import { TreeNode } from './TreeNode'

interface FileTreeProps {
  root: WorkspaceRoot
  rootRef: FileRef
}

export function FileTree({ root, rootRef }: FileTreeProps): JSX.Element {
  const { treeCache, expandedNodes, getChildren, setExpanded } = useFileTreeStore()

  useEffect(() => {
    getChildren(root, rootRef)
      .then(() => {
        setExpanded(rootRef.id, true)
      })
      .catch((err) => {
        console.error('Failed to load root directory:', err)
      })
  }, [root, rootRef, getChildren, setExpanded])

  const isExpanded = expandedNodes.has(rootRef.id)
  const children = treeCache.get(rootRef.id) || []

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      getChildren(root, rootRef).catch((err) => {
        console.error('Failed to expand directory:', err)
      })
    }
    setExpanded(rootRef.id, !isExpanded)
  }, [isExpanded, root, rootRef, getChildren, setExpanded])

  return (
    <div className="py-1 text-neutral-800">
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-1 px-2 py-1 text-sm hover:bg-neutral-100"
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} className="text-blue-500" />
        <span className="truncate">{rootRef.name}</span>
      </button>

      {isExpanded && (
        <ul className="ml-4">
          {children.map((child) => (
            <TreeNode key={child.id} root={root} ref={child} />
          ))}
        </ul>
      )}
    </div>
  )
}
