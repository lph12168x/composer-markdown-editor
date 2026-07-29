import { useCallback, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, RefreshCw } from 'lucide-react'
import type { FileRef, WorkspaceRoot } from '../../types/file'
import { useDocumentStore, useFileTreeStore } from '../../stores/fileStore'
import { TreeNode } from './TreeNode'
import { useSshReconnect } from './sshReconnect'

interface FileTreeProps {
  root: WorkspaceRoot
  rootRef: FileRef
}

export function FileTree({ root, rootRef }: FileTreeProps): JSX.Element {
  const {
    treeCache,
    expandedNodes,
    loadingNodes,
    getChildren,
    refreshNode,
    setExpanded
  } = useFileTreeStore()
  // Subscribe to the *active* document id so the highlighted tree row
  // updates as soon as the user switches tabs. We read only the field we
  // need so re-renders are limited to actual tab switches.
  const activeDocumentId = useDocumentStore((s) => s.activeDocumentId)
  const sshReconnect = useSshReconnect()

  useEffect(() => {
    // Resolve the saved credentials for this root up-front so the
    // reconnect helper can present the password prompt populated with
    // the right host/user/port/key path. Without it the helper falls
    // back to the currently-active SSH session, which may be stale.
    void (async () => {
      try {
        if (root.type === 'ssh' && sshReconnect) {
          const conn = await sshReconnect.findConnectionForRoot(root)
          if (conn) {
            await sshReconnect.ensureSshConnected(conn)
          } else {
            await sshReconnect.ensureSshConnected()
          }
        }
        await getChildren(root, rootRef)
        setExpanded(rootRef.id, true)
      } catch (err) {
        console.error('Failed to load root directory:', err)
      }
    })()
  }, [root, rootRef, getChildren, setExpanded, sshReconnect])

  const isExpanded = expandedNodes.has(rootRef.id)
  const children = treeCache.get(rootRef.id) || []
  // Show a spinner on the refresh button while any directory under this
  // tree is being re-read — covers the case where refreshing the root
  // cascades into every expanded child.
  const isRefreshing = loadingNodes.has(rootRef.id)

  const handleToggle = useCallback(async () => {
    if (!isExpanded) {
      try {
        if (root.type === 'ssh' && sshReconnect) {
          const conn = await sshReconnect.findConnectionForRoot(root)
          if (conn) {
            await sshReconnect.ensureSshConnected(conn)
          } else {
            await sshReconnect.ensureSshConnected()
          }
        }
        await getChildren(root, rootRef)
      } catch (err) {
        console.error('Failed to expand directory:', err)
      }
    }
    setExpanded(rootRef.id, !isExpanded)
  }, [isExpanded, root, rootRef, getChildren, setExpanded, sshReconnect])

  /**
   * Manually re-read every directory the user has expanded. We deliberately
   * skip collapsed subtrees: their cached content might still be stale,
   * but the next time the user expands them `getChildren` will fall back to
   * `refreshNode` and pull fresh data. Refreshing only what is visible
   * keeps the IPC footprint small and avoids spamming the disk on huge
   * trees where the user has explored only a small slice.
   */
  const handleRefresh = useCallback(async (): Promise<void> => {
    try {
      if (root.type === 'ssh' && sshReconnect) {
        const conn = await sshReconnect.findConnectionForRoot(root)
        if (conn) {
          await sshReconnect.ensureSshConnected(conn)
        } else {
          await sshReconnect.ensureSshConnected()
        }
      }

      const rootId = rootRef.id
      // Always refresh the root, regardless of expand state — that's the
      // primary reason the user hits the button after an external change.
      await refreshNode(root, rootRef)
      // Refresh every expanded directory descendant. Filter on
      // `expandedNodes.has(...)` instead of `treeCache.has(...)` so we don't
      // waste IPC roundtrips on cached-but-collapsed branches.
      const cache = useFileTreeStore.getState().treeCache
      for (const [parentId, kids] of cache.entries()) {
        if (!parentId.startsWith(`${rootId}:`)) continue
        if (!expandedNodes.has(parentId)) continue
        // Build a FileRef for the parent so refreshNode can re-read it.
        const parentRef: FileRef = {
          id: parentId,
          rootId: root.id,
          type: root.type,
          path: parentId.slice(rootId.length + 1),
          name: parentId.split('/').pop() ?? parentId,
          isDirectory: true
        }
        void kids // kids already match what refreshNode will fetch; refetch keeps cache honest
        await refreshNode(root, parentRef)
      }
    } catch (err) {
      console.error('Failed to refresh directory:', err)
    }
  }, [root, rootRef, refreshNode, expandedNodes, sshReconnect])

  return (
    <div className="py-1 text-neutral-800">
      <div className="group flex items-center">
        <button
          onClick={handleToggle}
          className="flex flex-1 items-center gap-1 px-2 py-1 text-left text-sm hover:bg-neutral-100"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} className="text-blue-500" />
          <span className="truncate">{rootRef.name}</span>
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh tree (re-read this root and every expanded folder)"
          aria-label="Refresh tree"
          className="mr-1 rounded p-1 text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-neutral-800"
        >
          <RefreshCw
            size={12}
            className={isRefreshing ? 'animate-spin text-blue-500' : undefined}
          />
        </button>
      </div>

      {isExpanded && (
        <ul className="ml-4">
          {children.map((child) => (
            <TreeNode key={child.id} root={root} ref={child} activeRefId={activeDocumentId} />
          ))}
        </ul>
      )}
    </div>
  )
}
