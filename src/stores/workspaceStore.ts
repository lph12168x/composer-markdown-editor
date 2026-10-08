import { create } from 'zustand'
import type { Workspace, WorkspaceRoot } from '../types/file'
import { useSshStore } from './sshStore'
import { settingsClient } from '../services/settingsClient'

interface WorkspaceState {
  workspace: Workspace
  activeRootId: string | null
  /**
   * Roots the user collapsed in the workspace list. Everything below that row
   * (file tree, git panel) is hidden while its id is here.
   */
  collapsedRootIds: Set<string>
  addLocalRoot: (path: string, name?: string) => void
  addSshRoot: (root: WorkspaceRoot) => void
  removeRoot: (rootId: string) => void
  setActiveRoot: (rootId: string | null) => void
  toggleRootCollapsed: (rootId: string) => void
  setWorkspaceName: (name: string) => void
  loadWorkspace: (workspace: Workspace, activeRootId?: string | null) => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getRootName(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: {
    id: generateId(),
    name: 'Untitled Workspace',
    roots: []
  },
  activeRootId: null,
  collapsedRootIds: new Set(),

  addLocalRoot: (path: string, name?: string) => {
    const root: WorkspaceRoot = {
      id: generateId(),
      type: 'local',
      name: name || getRootName(path),
      path
    }

    set((state) => ({
      workspace: {
        ...state.workspace,
        roots: [...state.workspace.roots, root]
      },
      activeRootId: state.activeRootId || root.id
    }))

    void settingsClient.addRecentDir(path)
    void settingsClient.saveWorkspace(get().workspace.roots)
  },

  addSshRoot: (root: WorkspaceRoot) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        roots: [...state.workspace.roots, root]
      },
      activeRootId: state.activeRootId || root.id
    }))

    void settingsClient.saveWorkspace(get().workspace.roots)
  },

  removeRoot: (rootId: string) => {
    set((state) => {
      const root = state.workspace.roots.find((r) => r.id === rootId)
      const remainingRoots = state.workspace.roots.filter((r) => r.id !== rootId)
      const collapsed = new Set(state.collapsedRootIds)
      collapsed.delete(rootId)
      if (root?.type === 'ssh' && !remainingRoots.some((r) => r.type === 'ssh')) {
        void useSshStore.getState().disconnect()
      }

      return {
        workspace: {
          ...state.workspace,
          roots: remainingRoots
        },
        collapsedRootIds: collapsed,
        activeRootId:
          state.activeRootId === rootId
            ? remainingRoots.find((r) => r.id !== rootId)?.id || null
            : state.activeRootId
      }
    })

    void settingsClient.saveWorkspace(get().workspace.roots)
  },

  setActiveRoot: (rootId: string | null) => {
    set({ activeRootId: rootId })
  },

  toggleRootCollapsed: (rootId: string) => {
    set((state) => {
      const collapsed = new Set(state.collapsedRootIds)
      if (collapsed.has(rootId)) {
        collapsed.delete(rootId)
      } else {
        collapsed.add(rootId)
      }
      return { collapsedRootIds: collapsed }
    })
  },

  setWorkspaceName: (name: string) => {
    set((state) => ({
      workspace: { ...state.workspace, name }
    }))
  },

  loadWorkspace: (workspace: Workspace, activeRootId?: string | null) => {
    set({
      workspace,
      activeRootId: activeRootId ?? workspace.activeRootId ?? workspace.roots[0]?.id ?? null
    })
  }
}))
