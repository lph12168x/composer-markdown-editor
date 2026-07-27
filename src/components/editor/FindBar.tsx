import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'

/**
 * Command-style interface every editor implements to back the FindBar.
 * `search` is incremental — the editor must update its highlight and match
 * count without waiting for the user to press Enter. `next`/`prev` move the
 * active match and return the 1-indexed position of the new active match.
 * `close` removes the highlight and resets the editor state.
 */
export interface FindController {
  /** Apply a new query. Returns the number of matches (0 if none). */
  search(query: string): number
  /** Move to the next match, wrapping at the end. Returns 1-indexed position. */
  next(): number
  /** Move to the previous match, wrapping at the start. Returns 1-indexed position. */
  prev(): number
  /** Clear highlights and tear down any internal listeners. */
  close(): void
}

interface FindBarProps {
  /** Returns the controller for the currently mounted editor, or null if the
   *  active document can't be searched (e.g. an image tab). */
  getController: () => FindController | null
  /** Current query state lives outside the bar so the parent can decide
   *  whether the bar should be open at all (mode/keyboard shortcut). */
  open: boolean
  onClose: () => void
}

const NO_MATCHES = 'No matches'
const countText = (pos: number, total: number): string =>
  total === 0 ? NO_MATCHES : `${pos}/${total}`

/**
 * The shared top-of-editor search bar used across source / preview / edit
 * modes. It owns the input, the match counter, and the keyboard surface
 * (Enter / Shift+Enter / Esc). The actual highlight + scroll happens in
 * the editor, accessed through `getController()`.
 */
export function FindBar({ getController, open, onClose }: FindBarProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(0)
  const [position, setPosition] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // Latest controller snapshot — `getController()` may re-run each tick
  // and the editor can publish a new controller at any time (e.g. after
  // Crepe finishes mounting). Snapshotting avoids re-subscribing the
  // search effect on every remount.
  const latestControllerRef = useRef<FindController | null>(null)
  const refreshController = useCallback((): FindController | null => {
    const c = getController()
    latestControllerRef.current = c
    return c
  }, [getController])

  // Focus input when opened. We rely on both the `autoFocus` attribute on
  // the <input> (browser-native) and an explicit rAF focus() here, so
  // the bar works regardless of whether the user opened it before or
  // after the editor finished mounting (autoFocus only fires once per
  // mount, but the user might toggle the bar while the input is already
  // in the tree).
  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) {
      // Clear residual state when the bar is dismissed. `open` is in
      // the dep list, so this is the legitimate "reset on dependency
      // change" pattern, not a cascading render.
      const ctrl = latestControllerRef.current ?? getController()
      ctrl?.close()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('')
      setCount(0)
      setPosition(0)
    }
  }, [open, getController])

  // Re-run search whenever the query changes, debounced so we don't
  // rebuild highlights on every keystroke. The editor's `applyFind` does
  // a full DOM walk + unwrap + rewrap + smooth scroll, which is too
  // expensive to run synchronously per character on large documents.
  useEffect(() => {
    if (!open) return
    if (!query) {
      const ctrl = refreshController()
      ctrl?.close()
      setCount(0)
      setPosition(0)
      return
    }
    const timer = setTimeout(() => {
      const ctrl = refreshController()
      if (!ctrl) {
        setCount(0)
        setPosition(0)
        return
      }
      const n = ctrl.search(query)
      setCount(n)
      setPosition(n > 0 ? 1 : 0)
    }, 200)
    return () => clearTimeout(timer)
    // `ctrl` is captured freshly each time via refreshController; we just
    // re-run on query/open changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  if (!open) return null

  return (
    <div
      role="search"
      className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
    >
      <Search size={12} className="text-neutral-500" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Find in document"
        autoFocus
        // stopPropagation on keydown so the EditorPane window-level handler
        // (which intercepts Cmd+F / Esc) and any CodeMirror / ProseMirror
        // keymap listener further down the tree never see — or eat —
        // ordinary character input. Without this, source-mode CodeMirror
        // (which has searchKeymap bound to Cmd+F) can intermittently steal
        // keystrokes before they reach our <input>.
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            const ctrl = latestControllerRef.current ?? getController()
            if (!ctrl || !query) return
            if (e.shiftKey) setPosition(ctrl.prev())
            else setPosition(ctrl.next())
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100"
        aria-label="Find in document"
      />
      <span
        className={`min-w-[3.5rem] text-right tabular-nums ${
          count === 0 ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-600 dark:text-neutral-300'
        }`}
        aria-live="polite"
      >
        {query ? countText(position, count) : ''}
      </span>
      <button
        type="button"
        onClick={() => {
          const ctrl = latestControllerRef.current ?? getController()
          if (!ctrl || !query) return
          setPosition(ctrl.prev())
        }}
        disabled={count === 0}
        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-700"
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => {
          const ctrl = latestControllerRef.current ?? getController()
          if (!ctrl || !query) return
          setPosition(ctrl.next())
        }}
        disabled={count === 0}
        className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-700 dark:hover:bg-neutral-700"
        title="Next match (Enter)"
        aria-label="Next match"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        title="Close (Esc)"
        aria-label="Close find bar"
      >
        <X size={12} />
      </button>
    </div>
  )
}