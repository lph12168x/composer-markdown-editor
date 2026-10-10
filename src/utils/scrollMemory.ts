import type { EditorMode } from '../stores/uiStore'

/**
 * Reading position per open document, kept outside the zustand stores on
 * purpose: scroll fires at display rate and a reactive map would re-render the
 * tree on every tick.
 *
 * Keyed by document ref id AND view mode, because preview / edit / source each
 * have their own scroll height. Entries outlive `closeDocument`, so reopening a
 * file lands back where you left it.
 */
const offsets = new Map<string, number>()

export function scrollMemoryKey(refId: string, mode: EditorMode): string {
  return `${refId}:${mode}`
}

export function rememberScroll(key: string, top: number): void {
  offsets.set(key, top)
}

export function recallScroll(key: string): number {
  return offsets.get(key) ?? 0
}
