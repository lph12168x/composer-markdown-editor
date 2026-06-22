import { create } from 'zustand'
import type { Workspace, WorkspaceRoot } from '../types/file'

interface WorkspaceState {
  workspace: Workspace
  activeRootId: string | null
  addLocalRoot: (path: string, name?: string) => void
  removeRoot: (rootId: string) => void
  setActiveRoot: (rootId: string | null) => void
  setWorkspaceName: (name: string) => void
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getRootName(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}

export const useWorkspaceStore = create<WorkspaceState>((set, _get) => ({
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
  },

  removeRoot: (rootId: string) => {
    set((state) => ({
      workspace: {
        ...state.workspace,
        roots: state.workspace.roots.filter((r) => r.id !== rootId)
      },
      activeRootId:
        state.activeRootId === rootId
          ? state.workspace.roots.find((r) => r.id !== rootId)?.id || null
          : state.activeRootId
    }))
  },

  setActiveRoot: (rootId: string | null) => {
    set({ activeRootId: rootId })
  },

  setWorkspaceName: (name: string) => {
    set((state) => ({
      workspace: { ...state.workspace, name }
    }))
  }
}))
