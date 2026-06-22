import { create } from 'zustand'

export type EditorMode = 'edit' | 'preview' | 'source'

interface UiState {
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  toggleEditorMode: () => void
}

const nextMode: Record<EditorMode, EditorMode> = {
  edit: 'preview',
  preview: 'source',
  source: 'edit'
}

export const useUiStore = create<UiState>((set) => ({
  editorMode: 'source',
  setEditorMode: (mode) => set({ editorMode: mode }),
  toggleEditorMode: () => set((state) => ({ editorMode: nextMode[state.editorMode] }))
}))
