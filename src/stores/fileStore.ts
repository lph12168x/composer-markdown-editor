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
  updateRawContent: (rawContent: string) => void
  enterSourceMode: () => void
  markSaved: (savedContent: string) => void
  closeDocument: () => void
}

export const useDocumentStore = create<DocumentState>((set) => ({
  document: null,

  openDocument: (ref: FileRef, content: string) => {
    set({
      document: {
        ref,
        content,
        rawContent: content,
        originalContent: content,
        modified: false,
        loading: false,
        lastModifiedEditor: null,
        hasNormalized: false
      }
    })
  },

  updateContent: (content: string) => {
    set((state) => {
      if (!state.document) return state

      const doc = state.document
      // The first call from the WYSIWYG editor is the initial normalization on mount.
      if (!doc.hasNormalized) {
        return {
          document: {
            ...doc,
            content,
            originalContent: content,
            hasNormalized: true
          }
        }
      }

      if (content === doc.content) {
        return state
      }

      return {
        document: {
          ...doc,
          content,
          lastModifiedEditor: 'wysiwyg',
          modified: content !== doc.originalContent
        }
      }
    })
  },

  updateRawContent: (rawContent: string) => {
    set((state) => {
      if (!state.document) return state
      return {
        document: {
          ...state.document,
          rawContent,
          content: rawContent,
          lastModifiedEditor: 'source',
          modified: rawContent !== state.document.originalContent
        }
      }
    })
  },

  enterSourceMode: () => {
    set((state) => {
      if (!state.document) return state
      const doc = state.document

      // Source mode is authoritative when it was the last editor modified.
      // Otherwise bring the current canonical content into the source view.
      if (doc.lastModifiedEditor === 'source') {
        return {
          document: {
            ...doc,
            content: doc.rawContent
          }
        }
      }

      if (doc.lastModifiedEditor === 'wysiwyg') {
        return {
          document: {
            ...doc,
            rawContent: doc.content,
            modified: doc.content !== doc.originalContent
          }
        }
      }

      // No edits yet: keep the raw file content in source view without marking modified.
      return {
        document: {
          ...doc,
          content: doc.rawContent,
          modified: false
        }
      }
    })
  },

  markSaved: (savedContent: string) => {
    set((state) => {
      if (!state.document) return state
      return {
        document: {
          ...state.document,
          content: savedContent,
          rawContent: savedContent,
          originalContent: savedContent,
          modified: false,
          lastModifiedEditor: null
        }
      }
    })
  },

  closeDocument: () => {
    set({ document: null })
  }
}))
