import { create } from 'zustand'
import type { WorkspaceRoot } from '../types/file'

export type EditorMode = 'edit' | 'preview' | 'source' | 'diff'

export interface DiffTarget {
  root: WorkspaceRoot
  repoPath: string
  filePath: string
}

interface UiState {
  editorMode: EditorMode
  diffTarget: DiffTarget | null
  setEditorMode: (mode: EditorMode) => void
  openDiff: (target: DiffTarget) => void
  closeDiff: () => void
  toggleEditorMode: () => void
}

const nextMode: Record<Exclude<EditorMode, 'diff'>, Exclude<EditorMode, 'diff'>> = {
  edit: 'preview',
  preview: 'source',
  source: 'edit'
}

export const useUiStore = create<UiState>((set) => ({
  // Opening a document lands in preview by default; users switch to
  // source / edit via the mode toggle when they want to change the file.
  editorMode: 'preview',
  diffTarget: null,
  setEditorMode: (mode) =>
    set((state) => ({
      editorMode: mode,
      diffTarget: mode === 'diff' ? state.diffTarget : null
    })),
  openDiff: (target) => set({ editorMode: 'diff', diffTarget: target }),
  closeDiff: () => set({ editorMode: 'source', diffTarget: null }),
  toggleEditorMode: () =>
    set((state) => ({
      editorMode: nextMode[state.editorMode as Exclude<EditorMode, 'diff'>] ?? 'source',
      diffTarget: null
    }))
}))
