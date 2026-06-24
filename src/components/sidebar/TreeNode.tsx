import { useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react'
import type { FileRef, WorkspaceRoot } from '../../types/file'
import { useFileTreeStore } from '../../stores/fileStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { ContextMenu } from './TreeContextMenu'
import { InlineRename } from './InlineRename'

function basename(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}

function uniqueDefaultName(siblings: FileRef[], isFile: boolean): string {
  const base = isFile ? 'new-file.md' : 'new-folder'
  if (!siblings.some((s) => s.name === base)) return base
  let i = 1
  while (true) {
    const name = isFile ? `new-file-${i}.md` : `new-folder-${i}`
    if (!siblings.some((s) => s.name === name)) return name
    i++
  }
}

function alertError(err: unknown, fallback: string): void {
  window.alert(err instanceof Error ? err.message : fallback)
}

interface TreeNodeProps {
  root: WorkspaceRoot
  ref: FileRef
  depth?: number
}

export function TreeNode({ root, ref, depth = 0 }: TreeNodeProps): JSX.Element {
  const { treeCache, expandedNodes, getChildren, refreshNode, setExpanded } = useFileTreeStore()
  const [isLoading, setIsLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [creating, setCreating] = useState<'file' | 'dir' | null>(null)

  const isExpanded = expandedNodes.has(ref.id)
  const children = ref.isDirectory ? treeCache.get(ref.id) : undefined

  const refreshParent = useCallback(async () => {
    // Refresh parent directory to show new/renamed/deleted items
    const parentPath = ref.path.substring(0, ref.path.lastIndexOf('/'))
    if (!parentPath || parentPath === root.path) {
      // Item is directly under root, refresh root
      if (expandedNodes.has(root.id)) {
        await refreshNode(root, { ...ref, path: root.path || '', id: root.id })
      }
      return
    }

    const parentId = `${root.id}:${parentPath}`
    if (expandedNodes.has(parentId)) {
      const parentRef: FileRef = {
        id: parentId,
        rootId: root.id,
        type: root.type,
        path: parentPath,
        name: basename(parentPath),
        isDirectory: true
      }
      await refreshNode(root, parentRef)
    }
  }, [ref, root, expandedNodes, refreshNode])

  const handleToggle = useCallback(async () => {
    if (!ref.isDirectory) return

    if (!isExpanded) {
      setIsLoading(true)
      try {
        await getChildren(root, ref)
      } catch (err) {
        alertError(err, 'Failed to expand directory')
      } finally {
        setIsLoading(false)
      }
    }

    setExpanded(ref.id, !isExpanded)
  }, [isExpanded, ref, root, getChildren, setExpanded])

  const handleDoubleClick = (): void => {
    if (ref.isDirectory) return
    window.dispatchEvent(new CustomEvent('file:open', { detail: ref }))
  }

  const handleContextMenu = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleRename = async (newName: string): Promise<void> => {
    setRenaming(false)
    if (!newName || newName === ref.name) return

    try {
      await fileSystemClient.rename(ref, newName)
      await refreshParent()
    } catch (err) {
      alertError(err, 'Failed to rename item')
    }
  }

  const handleCreate = async (name: string): Promise<void> => {
    if (!name) {
      setCreating(null)
      return
    }

    try {
      if (!ref.isDirectory) {
        await fileSystemClient.createFile(ref, name)
      } else {
        await (creating === 'file'
          ? fileSystemClient.createFile(ref, name)
          : fileSystemClient.createDir(ref, name))
      }
      setCreating(null)
      await refreshNode(root, ref)
      if (!isExpanded) setExpanded(ref.id, true)
    } catch (err) {
      alertError(err, 'Failed to create item')
    }
  }

  const handleDelete = async (): Promise<void> => {
    try {
      await fileSystemClient.delete(ref)
      await refreshParent()
    } catch (err) {
      alertError(err, 'Failed to delete item')
    }
  }

  if (renaming) {
    return (
      <li style={{ paddingLeft: `${8 + depth * 12}px` }} className="px-2 py-1">
        <InlineRename
          initialName={ref.name}
          onConfirm={handleRename}
          onCancel={() => setRenaming(false)}
        />
      </li>
    )
  }

  return (
    <li onContextMenu={handleContextMenu}>
      <button
        onClick={handleToggle}
        onDoubleClick={handleDoubleClick}
        className="flex w-full items-center gap-1 px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-100"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {ref.isDirectory ? (
          isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )
        ) : (
          <span className="w-3.5" />
        )}

        {ref.isDirectory ? (
          <Folder size={14} className="text-blue-500" />
        ) : (
          <FileText size={14} className="text-neutral-500" />
        )}

        <span className={`truncate ${ref.isDirectory ? '' : 'text-neutral-700'}`}>{ref.name}</span>

        {isLoading && <span className="ml-1 text-xs text-neutral-400">...</span>}
      </button>

      {ref.isDirectory && isExpanded && children && (
        <ul>
          {children.map((child) => (
            <TreeNode key={child.id} root={root} ref={child} depth={depth + 1} />
          ))}
          {creating && (
            <li style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }} className="px-2 py-1">
              <InlineRename
                initialName={uniqueDefaultName(children, creating === 'file')}
                onConfirm={handleCreate}
                onCancel={() => setCreating(null)}
              />
            </li>
          )}
        </ul>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          ref={ref}
          onClose={() => setContextMenu(null)}
          onNewFile={() => ref.isDirectory && setCreating('file')}
          onNewFolder={() => ref.isDirectory && setCreating('dir')}
          onRename={() => setRenaming(true)}
          onDelete={handleDelete}
        />
      )}
    </li>
  )
}
