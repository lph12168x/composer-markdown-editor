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
  editorMode: 'source',
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
