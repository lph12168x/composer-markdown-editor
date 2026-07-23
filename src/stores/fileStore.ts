import { create } from 'zustand'
import type { Document, FileRef, WorkspaceRoot } from '../types/file'
import { fileSystemClient } from '../services/fileSystemClient'
import { settingsClient } from '../services/settingsClient'
import { APP_CHANNELS } from '../types/ipc'

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
  documents: Document[]
  activeDocumentId: string | null
  document: Document | null
  openDocument: (ref: FileRef, content: string) => void
  openImageDocument: (ref: FileRef, dataUrl: string) => void
  activateDocument: (id: string) => void
  updateContent: (content: string) => void
  updateRawContent: (rawContent: string) => void
  enterSourceMode: () => void
  markSaved: (savedContent: string) => void
  closeDocument: (id?: string) => Promise<void>
  updateRef: (ref: FileRef) => void
}

/**
 * Image extensions that the file tree recognizes as image documents.
 * Kept in sync with the MIME map inside `LocalFileSystemProvider.readFileAsDataUrl`.
 */
export const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp'
])

export function isImageRef(ref: FileRef): boolean {
  // ref.name carries the basename; ref.path is also fine and survives rename.
  const dot = ref.name.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(ref.name.slice(dot).toLowerCase())
}

function createDocument(ref: FileRef, content: string): Document {
  return {
    ref,
    kind: 'markdown',
    content,
    rawContent: content,
    originalContent: content,
    modified: false,
    loading: false,
    lastModifiedEditor: null,
    hasNormalized: false
  }
}

function createImageDocument(ref: FileRef, dataUrl: string): Document {
  return {
    ref,
    kind: 'image',
    // For image docs `content` doubles as the data URL — renderers and the
    // Tab title only ever read `ref.name`, so it's safe to overload the
    // field rather than add a sibling `dataUrl?: string`.
    content: dataUrl,
    rawContent: dataUrl,
    originalContent: dataUrl,
    modified: false,
    loading: false,
    lastModifiedEditor: null,
    hasNormalized: false
  }
}

function findActiveDocument(documents: Document[], activeDocumentId: string | null): Document | null {
  if (!activeDocumentId) return null
  return documents.find((doc) => doc.ref.id === activeDocumentId) ?? null
}

function reportModified(documents: Document[]): void {
  const modified = documents.some((doc) => doc.modified)
  window.electronAPI.invoke<void>(APP_CHANNELS.MODIFIED, modified).catch((err) => {
    console.error('Failed to report modified state:', err)
  })
}

function getActiveIndex(state: DocumentState): number {
  if (!state.activeDocumentId) return -1
  return state.documents.findIndex((doc) => doc.ref.id === state.activeDocumentId)
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  document: null,

  openDocument: (ref: FileRef, content: string) => {
    set((state) => {
      const existingIndex = state.documents.findIndex((doc) => doc.ref.id === ref.id)
      let nextDocuments: Document[]
      if (existingIndex >= 0) {
        nextDocuments = [...state.documents]
        nextDocuments[existingIndex] = {
          ...nextDocuments[existingIndex],
          content,
          rawContent: content,
          originalContent: content,
          modified: false,
          hasNormalized: false,
          lastModifiedEditor: null
        }
      } else {
        nextDocuments = [...state.documents, createDocument(ref, content)]
      }
      reportModified(nextDocuments)
      return {
        documents: nextDocuments,
        activeDocumentId: ref.id,
        document: findActiveDocument(nextDocuments, ref.id)
      }
    })

    void settingsClient.addRecentFile({
      id: ref.id,
      rootId: ref.rootId,
      type: ref.type,
      path: ref.path,
      name: ref.name
    })
  },

  openImageDocument: (ref: FileRef, dataUrl: string) => {
    set((state) => {
      const existingIndex = state.documents.findIndex((doc) => doc.ref.id === ref.id)
      let nextDocuments: Document[]
      if (existingIndex >= 0) {
        // Reopening the same image just refreshes the bytes — kind is
        // already set and won't change on the same ref.
        nextDocuments = [...state.documents]
        nextDocuments[existingIndex] = {
          ...nextDocuments[existingIndex],
          kind: 'image',
          content: dataUrl,
          rawContent: dataUrl,
          originalContent: dataUrl,
          modified: false,
          lastModifiedEditor: null
        }
      } else {
        nextDocuments = [...state.documents, createImageDocument(ref, dataUrl)]
      }
      reportModified(nextDocuments)
      return {
        documents: nextDocuments,
        activeDocumentId: ref.id,
        document: findActiveDocument(nextDocuments, ref.id)
      }
    })

    void settingsClient.addRecentFile({
      id: ref.id,
      rootId: ref.rootId,
      type: ref.type,
      path: ref.path,
      name: ref.name
    })
  },

  activateDocument: (id: string) => {
    set((state) => {
      if (state.activeDocumentId === id) return state
      if (!state.documents.some((doc) => doc.ref.id === id)) return state
      return {
        activeDocumentId: id,
        document: findActiveDocument(state.documents, id)
      }
    })
  },

  updateContent: (content: string) => {
    set((state) => {
      const index = getActiveIndex(state)
      if (index === -1) return state
      const doc = state.documents[index]

      // The first call from the WYSIWYG editor is the initial normalization on mount.
      if (!doc.hasNormalized) {
        const updated = {
          ...doc,
          content,
          originalContent: content,
          hasNormalized: true
        }
        const nextDocuments = [...state.documents]
        nextDocuments[index] = updated
        reportModified(nextDocuments)
        return { documents: nextDocuments, document: updated }
      }

      if (content === doc.content) {
        return state
      }

      const modified = content !== doc.originalContent
      const updated = {
        ...doc,
        content,
        lastModifiedEditor: 'wysiwyg' as const,
        modified
      }
      const nextDocuments = [...state.documents]
      nextDocuments[index] = updated
      reportModified(nextDocuments)
      return { documents: nextDocuments, document: updated }
    })
  },

  updateRawContent: (rawContent: string) => {
    set((state) => {
      const index = getActiveIndex(state)
      if (index === -1) return state
      const doc = state.documents[index]
      const modified = rawContent !== doc.originalContent
      const updated = {
        ...doc,
        rawContent,
        content: rawContent,
        lastModifiedEditor: 'source' as const,
        modified
      }
      const nextDocuments = [...state.documents]
      nextDocuments[index] = updated
      reportModified(nextDocuments)
      return { documents: nextDocuments, document: updated }
    })
  },

  enterSourceMode: () => {
    set((state) => {
      const index = getActiveIndex(state)
      if (index === -1) return state
      const doc = state.documents[index]

      // Source mode is authoritative when it was the last editor modified.
      // Otherwise bring the current canonical content into the source view.
      if (doc.lastModifiedEditor === 'source') {
        const updated = { ...doc, content: doc.rawContent }
        const nextDocuments = [...state.documents]
        nextDocuments[index] = updated
        return { documents: nextDocuments, document: updated }
      }

      if (doc.lastModifiedEditor === 'wysiwyg') {
        const modified = doc.content !== doc.originalContent
        const updated = { ...doc, rawContent: doc.content, modified }
        const nextDocuments = [...state.documents]
        nextDocuments[index] = updated
        reportModified(nextDocuments)
        return { documents: nextDocuments, document: updated }
      }

      // No edits yet: keep the raw file content in source view without marking modified.
      const updated = { ...doc, content: doc.rawContent, modified: false }
      const nextDocuments = [...state.documents]
      nextDocuments[index] = updated
      return { documents: nextDocuments, document: updated }
    })
  },

  markSaved: (savedContent: string) => {
    set((state) => {
      const index = getActiveIndex(state)
      if (index === -1) return state
      const doc = state.documents[index]
      const updated = {
        ...doc,
        content: savedContent,
        rawContent: savedContent,
        originalContent: savedContent,
        modified: false,
        lastModifiedEditor: null
      }
      const nextDocuments = [...state.documents]
      nextDocuments[index] = updated
      reportModified(nextDocuments)
      return { documents: nextDocuments, document: updated }
    })
  },

  closeDocument: async (id?: string) => {
    const targetId = id ?? get().activeDocumentId
    if (!targetId) return

    const doc = get().documents.find((d) => d.ref.id === targetId)
    if (!doc) return

    if (doc.modified) {
      const shouldSave = window.confirm('文件已修改，关闭前是否保存？')
      if (!shouldSave) return
      try {
        await fileSystemClient.writeFile(doc.ref, doc.content)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save file'
        window.alert(message)
        console.error('Failed to save file before closing:', err)
        return
      }
    }

    set((state) => {
      const index = state.documents.findIndex((d) => d.ref.id === targetId)
      if (index === -1) return state
      const nextDocuments = state.documents.filter((d) => d.ref.id !== targetId)
      let nextActiveId = state.activeDocumentId
      if (state.activeDocumentId === targetId) {
        const neighbor = state.documents[index - 1] ?? state.documents[index + 1]
        nextActiveId = neighbor?.ref.id ?? null
      }
      reportModified(nextDocuments)
      return {
        documents: nextDocuments,
        activeDocumentId: nextActiveId,
        document: findActiveDocument(nextDocuments, nextActiveId)
      }
    })
  },

  updateRef: (ref: FileRef) => {
    set((state) => {
      const index = getActiveIndex(state)
      if (index === -1) return state
      const updated = { ...state.documents[index], ref }
      const nextDocuments = [...state.documents]
      nextDocuments[index] = updated
      return { documents: nextDocuments, document: updated }
    })
  }
}))
