import { create } from 'zustand'
import type { Document, FileRef, WorkspaceRoot } from '../types/file'
import { fileSystemClient } from '../services/fileSystemClient'

interface FileTreeState {
  treeCache: Map<string, FileRef[]>
  expandedNodes: Set<string>
  loadingNodes: Set<string>
  getChildren: (root: WorkspaceRoot, ref: FileRef) => Promise<FileRef[]>
  refreshNode: (root: WorkspaceRoot, ref: FileRef) => Promise<FileRef[]>
  setExpanded: (refId: string, expanded: boolean) => void
  clearTree: (rootId?: string) => void
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  treeCache: new Map(),
  expandedNodes: new Set(),
  loadingNodes: new Set(),

  getChildren: async (root: WorkspaceRoot, ref: FileRef) => {
    const cached = get().treeCache.get(ref.id)
    if (cached) {
      return cached
    }

    return get().refreshNode(root, ref)
  },

  refreshNode: async (root: WorkspaceRoot, ref: FileRef) => {
    set((state) => {
      const loading = new Set(state.loadingNodes)
      loading.add(ref.id)
      return { loadingNodes: loading }
    })

    try {
      const children = await fileSystemClient.readDir(root, ref)
      set((state) => {
        const cache = new Map(state.treeCache)
        cache.set(ref.id, children)
        const loading = new Set(state.loadingNodes)
        loading.delete(ref.id)
        return { treeCache: cache, loadingNodes: loading }
      })
      return children
    } catch (error) {
      set((state) => {
        const loading = new Set(state.loadingNodes)
        loading.delete(ref.id)
        return { loadingNodes: loading }
      })
      throw error
    }
  },

  setExpanded: (refId: string, expanded: boolean) => {
    set((state) => {
      const expandedNodes = new Set(state.expandedNodes)
      if (expanded) {
        expandedNodes.add(refId)
      } else {
        expandedNodes.delete(refId)
      }
      return { expandedNodes }
    })
  },

  clearTree: (rootId?: string) => {
    if (rootId) {
      set((state) => {
        const cache = new Map(state.treeCache)
        for (const key of cache.keys()) {
          if (key.startsWith(`${rootId}:`)) {
            cache.delete(key)
          }
        }
        return { treeCache: cache }
      })
    } else {
      set({ treeCache: new Map(), expandedNodes: new Set() })
    }
  }
}))

interface DocumentState {
  document: Document | null
  openDocument: (ref: FileRef, content: string) => void
  updateContent: (content: string) => void
  markSaved: () => void
  closeDocument: () => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  document: null,

  openDocument: (ref: FileRef, content: string) => {
    set({
      document: {
        ref,
        content,
        originalContent: content,
        modified: false,
        loading: false
      }
    })
  },

  updateContent: (content: string) => {
    set((state) => {
      if (!state.document) return state
      return {
        document: {
          ...state.document,
          content,
          modified: content !== state.document.originalContent
        }
      }
    })
  },

  markSaved: () => {
    set((state) => {
      if (!state.document) return state
      return {
        document: {
          ...state.document,
          originalContent: state.document.content,
          modified: false
        }
      }
    })
  },

  closeDocument: () => {
    set({ document: null })
  }
}))
