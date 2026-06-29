import { create } from 'zustand'
import type { Workspace, WorkspaceRoot } from '../types/file'
import { useSshStore } from './sshStore'
import { settingsClient } from '../services/settingsClient'

interface WorkspaceState {
  workspace: Workspace
  activeRootId: string | null
  addLocalRoot: (path: string, name?: string) => void
  addSshRoot: (root: WorkspaceRoot) => void
  removeRoot: (rootId: string) => void
  setActiveRoot: (rootId: string | null) => void
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
      if (root?.type === 'ssh') {
        void useSshStore.getState().disconnect()
      }

      return {
        workspace: {
          ...state.workspace,
          roots: state.workspace.roots.filter((r) => r.id !== rootId)
        },
        activeRootId:
          state.activeRootId === rootId
            ? state.workspace.roots.find((r) => r.id !== rootId)?.id || null
            : state.activeRootId
      }
    })

    void settingsClient.saveWorkspace(get().workspace.roots)
  },

  setActiveRoot: (rootId: string | null) => {
    set({ activeRootId: rootId })
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
