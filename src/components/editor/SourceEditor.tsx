import { useEffect, useMemo, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap, Decoration } from '@codemirror/view'
import { Prec, StateEffect, StateField, RangeSet } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { EditorProps } from '../../types/editor'
import { parseMarkdownHeadings, type ParsedHeading } from '../../utils/markdownHeadings'
import type { Heading } from './TocPanel'
import type { FindController } from './FindBar'

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#2563eb', fontWeight: 'bold' },
  { tag: tags.strong, color: '#dc2626', fontWeight: 'bold' },
  { tag: tags.emphasis, color: '#7c3aed', fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#2563eb' },
  { tag: tags.monospace, color: '#dc2626', backgroundColor: '#f3f4f6', borderRadius: '3px', padding: '0 2px' },
  { tag: tags.quote, color: '#6b7280', fontStyle: 'italic' },
  { tag: tags.list, color: '#374151' },
  { tag: tags.meta, color: '#9ca3af' },
  { tag: tags.comment, color: '#9ca3af', fontStyle: 'italic' },
  { tag: tags.invalid, color: '#ef4304' }
])

/**
 * Sentinel controller handed back to the parent right before SourceEditor
 * unmounts. The FindBar only ever calls the *latest* controller, so a
 * harmless no-op keeps the FindBar from crashing if the user closes the
 * bar after the editor has been swapped out.
 */
const NOOP_CONTROLLER: FindController = {
  search: () => 0,
  next: () => 0,
  prev: () => 0,
  close: () => {}
}

// --- Find via CodeMirror Decoration API ---
// Previously we manually wrapped text nodes in <span class="cm-find-match">,
// but CM's internal re-decoration cycle strips those custom DOM nodes,
// causing the highlights to flicker or vanish entirely.  Using StateField +
// Decoration.mark integrates with CM's own rendering pipeline so the
// decorations survive every re-render.

const setFindQuery = StateEffect.define<{ query: string; activeIndex: number }>()

const matchDeco = Decoration.mark({ class: 'cm-find-match' })
const activeDeco = Decoration.mark({ class: 'cm-find-match cm-find-active' })

/** Scan the document text and build a RangeSet of match/active decorations. */
function buildFindDecorations(
  doc: string,
  query: string,
  activeIndex: number
): RangeSet<Decoration> {
  if (!query) return RangeSet.empty
  const needle = query.toLowerCase()
  if (!needle) return RangeSet.empty
  const lower = doc.toLowerCase()
  const decos: ReturnType<typeof matchDeco.range>[] = []
  let pos = 0
  let matchIdx = 0
  for (;;) {
    const idx = lower.indexOf(needle, pos)
    if (idx < 0) break
    if (matchIdx === activeIndex) {
      decos.push(activeDeco.range(idx, idx + needle.length))
    } else {
      decos.push(matchDeco.range(idx, idx + needle.length))
    }
    pos = idx + needle.length
    matchIdx++
  }
  return RangeSet.of(decos, true)
}

/** Count case-insensitive occurrences of `needle` in `doc`. */
function countMatches(doc: string, needle: string): number {
  if (!needle) return 0
  const lower = doc.toLowerCase()
  const n = needle.toLowerCase()
  let count = 0
  let pos = 0
  for (;;) {
    const idx = lower.indexOf(n, pos)
    if (idx < 0) break
    count++
    pos = idx + n.length
  }
  return count
}

/** Return the document offset of the `activeIndex`-th match (0-indexed). */
function matchOffset(doc: string, needle: string, activeIndex: number): number {
  const lower = doc.toLowerCase()
  const n = needle.toLowerCase()
  let pos = 0
  let matchIdx = 0
  for (;;) {
    const idx = lower.indexOf(n, pos)
    if (idx < 0) return -1
    if (matchIdx === activeIndex) return idx
    pos = idx + n.length
    matchIdx++
  }
}

const findField = StateField.define<RangeSet<Decoration>>({
  create() {
    return RangeSet.empty
  },
  update(value, tr) {
    value = value.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setFindQuery)) {
        const { query, activeIndex } = effect.value
        return buildFindDecorations(
          tr.state.doc.toString(),
          query,
          activeIndex
        )
      }
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})

/** Extra prop on top of `EditorProps` so SourceEditor can report headings. */
export interface SourceEditorProps extends EditorProps {
  /**
   * Called with the heading currently visible at the top of the editor
   * (or `null` when there is no heading on screen). The caller is responsible
   * for any click-driven lock so the outline click that scrolled the body
   * is not clobbered by SourceEditor's own scroll-driven report.
   */
  onActiveHeadingChange?: (heading: Heading | null) => void
  /**
   * Called once when the editor is mounted with a `FindController` backed
   * by CodeMirror's `@codemirror/search` extension. The FindBar calls
   * these methods to drive in-document search; the editor handles the
   * highlight + scroll + count internally.
   */
  onFindController?: (controller: FindController) => void
}

/**
 * Source mode is fundamentally different from the rendered views: CodeMirror
 * does not emit semantic `<hN>` elements, it only paints flat `.cm-line`
 * nodes. We therefore cannot use IntersectionObserver here. Instead, we
 * listen to the scroller's `scroll` events and use CodeMirror's built-in
 * `posAtCoords` to translate a viewport Y coordinate back into a source
 * line number, then binary-search the parsed heading list.
 *
 * `headings` is held in a ref so the scroll callback closure stays stable
 * across re-renders — we don't want to re-attach the scroll listener on
 * every keystroke that edits the document.
 */
export function SourceEditor({
  content,
  onChange,
  onActiveHeadingChange,
  onFindController
}: SourceEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
  const headingsRef = useRef<ParsedHeading[]>([])
  // Find state for the in-editor FindBar. Lifted to the top of the
  // component so the mount effect can write into them.
  const currentQueryRef = useRef('')
  const activeIndexRef = useRef(0)
  const matchCountRef = useRef(0)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onActiveHeadingChangeRef.current = onActiveHeadingChange
  }, [onActiveHeadingChange])

  // Recompute the heading list whenever the content changes. We keep it in a
  // ref (not state) because the scroll handler reads it on every tick and we
  // don't want a re-render cascade on every keystroke.
  const headings = useMemo(() => parseMarkdownHeadings(content), [content])
  useEffect(() => {
    headingsRef.current = headings
  }, [headings])

  // Holds the latest controller callback so the CM-create effect can fire
  // it after the view is built (controllers must be backed by a real view).
  const onFindControllerRef = useRef(onFindController)
  useEffect(() => {
    onFindControllerRef.current = onFindController
  }, [onFindController])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        // Prevent CodeMirror's built-in search panel (from basicSetup's
        // searchKeymap) from opening on Cmd+F — our FindBar handles it.
        // Returning true marks the key as handled so CM's searchKeymap
        // is skipped, but the DOM event still bubbles to window where
        // EditorPane's handler opens the unified FindBar.
        Prec.highest(
          keymap.of([
            { key: 'Mod-f', run: () => true },
            { key: 'Mod-F', run: () => true }
          ])
        ),
        markdown(),
        syntaxHighlighting(markdownHighlightStyle),
        findField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(view.state.doc.toString())
            // Re-scan for matches if a search is active — findField's
            // update only *maps* existing decorations to new positions,
            // it doesn't re-scan for new/deleted matches from edits.
            if (currentQueryRef.current) {
              const doc = view.state.doc.toString()
              const count = countMatches(doc, currentQueryRef.current)
              matchCountRef.current = count
              if (activeIndexRef.current >= count) activeIndexRef.current = 0
              view.dispatch({
                effects: setFindQuery.of({
                  query: currentQueryRef.current,
                  activeIndex: activeIndexRef.current
                })
              })
            }
          }
        })
      ],
      parent: container
    })

    viewRef.current = view

    // FindController backed by CodeMirror's Decoration API. Dispatches
    // `setFindQuery` effects into the `findField` StateField, which builds
    // a RangeSet of match/active decorations that integrate with CM's
    // own rendering pipeline — highlights survive CM's internal re-decoration
    // cycle (unlike manual <span> insertion which was stripped on re-render).
    const controller: FindController = {
      search(query) {
        currentQueryRef.current = query
        activeIndexRef.current = 0
        const doc = view.state.doc.toString()
        const count = countMatches(doc, query)
        matchCountRef.current = count
        view.dispatch({ effects: setFindQuery.of({ query, activeIndex: 0 }) })
        if (count > 0) {
          const pos = matchOffset(doc, query, 0)
          view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
        }
        return count
      },
      next() {
        if (!currentQueryRef.current) return 0
        const total = matchCountRef.current
        if (total === 0) return 0
        activeIndexRef.current = (activeIndexRef.current + 1) % total
        view.dispatch({
          effects: setFindQuery.of({
            query: currentQueryRef.current,
            activeIndex: activeIndexRef.current
          })
        })
        const pos = matchOffset(
          view.state.doc.toString(),
          currentQueryRef.current,
          activeIndexRef.current
        )
        if (pos >= 0) {
          view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
        }
        return activeIndexRef.current + 1
      },
      prev() {
        if (!currentQueryRef.current) return 0
        const total = matchCountRef.current
        if (total === 0) return 0
        activeIndexRef.current = (activeIndexRef.current - 1 + total) % total
        view.dispatch({
          effects: setFindQuery.of({
            query: currentQueryRef.current,
            activeIndex: activeIndexRef.current
          })
        })
        const pos = matchOffset(
          view.state.doc.toString(),
          currentQueryRef.current,
          activeIndexRef.current
        )
        if (pos >= 0) {
          view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
        }
        return activeIndexRef.current + 1
      },
      close() {
        currentQueryRef.current = ''
        activeIndexRef.current = 0
        matchCountRef.current = 0
        view.dispatch({ effects: setFindQuery.of({ query: '', activeIndex: 0 }) })
      }
    }
    onFindControllerRef.current?.(controller)

    return () => {
      onFindControllerRef.current?.(NOOP_CONTROLLER)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === content) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
      scrollIntoView: false
    })
  }, [content])

  // Active-heading tracking. Attaches to whatever element CodeMirror exposes
  // as its scroll container (`view.scrollDOM`). `posAtCoords` returns the
  // document position under a viewport coordinate, which we then convert to
  // a 0-indexed line number and look up against the parsed heading list.
  useEffect(() => {
    const view = viewRef.current
    const report = onActiveHeadingChangeRef.current
    if (!view || !report) return

    const scroller = view.scrollDOM

    const pickActive = (): void => {
      // No headings in this document → nothing to report.
      const list = headingsRef.current
      if (list.length === 0) {
        report(null)
        return
      }

      // Y coordinate of the 40% line within the viewport. Same threshold as
      // the App-level IO effect for edit/preview, so the user gets a
      // consistent "section the user is currently reading" experience across
      // all three modes.
      const rect = scroller.getBoundingClientRect()
      const yBand = rect.top + scroller.clientHeight * 0.4

      let pos = view.posAtCoords({ x: rect.left + 8, y: yBand })
      // `posAtCoords` returns null when the Y falls outside the document;
      // fall back to a coordinate we know is inside the text.
      if (pos == null) pos = view.posAtCoords({ x: rect.left + 8, y: rect.top + 4 })
      if (pos == null) {
        report(null)
        return
      }

      // `lineAt(pos).number` is 1-indexed; the heading parser is 0-indexed.
      const visibleLine = view.state.doc.lineAt(pos).number - 1

      // Last heading whose `line` is at or before the visible line.
      let active: ParsedHeading | null = null
      for (const h of list) {
        if (h.line <= visibleLine) active = h
        else break
      }
      report(active)
    }

    // Re-evaluate when the user scrolls (wheel/keys/touchpad) or when the
    // viewport size changes (which would change what "top 40%" means).
    scroller.addEventListener('scroll', pickActive, { passive: true })
    const ro = new ResizeObserver(pickActive)
    ro.observe(scroller)

    // First pick. Wrap in rAF so the initial layout (CodeMirror rendering
    // line heights) has settled.
    const raf = requestAnimationFrame(pickActive)

    return () => {
      scroller.removeEventListener('scroll', pickActive)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [onActiveHeadingChange])

  // Outline-click handler support. App dispatches a CustomEvent on the
  // `[data-editor-scroll="true"]` element with `detail: { line: number }`;
  // we translate the 0-indexed line number to a CodeMirror document
  // position and scroll the editor so that line sits 16px below the top
  // of the visible area (mirrors the offset used in `App.handleHeadingClick`).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handler = (event: Event): void => {
      const view = viewRef.current
      if (!view) return
      const ce = event as CustomEvent<{ line?: number }>
      const line = ce.detail?.line
      if (typeof line !== 'number') return

      const doc = view.state.doc
      if (line < 0 || line >= doc.lines) return
      const lineInfo = doc.line(line + 1) // 1-indexed

      // Use CodeMirror's built-in scrollIntoView effect: it computes the
      // proper pixel offset against the current scrollTop (and respects
      // wrapping, RTL, hidden-line folding, etc.) and writes it through the
      // editor's measure phase so the scroll lands atomically with layout.
      // Hand-rolling `coordsAtPos` + `scrollTo` here produced a negative
      // scrollTop whenever the target line was already inside (or above)
      // the viewport — the browser clamps negative values to 0 and the
      // click silently no-ops, which is exactly the bug this fixes.
      view.dispatch({
        effects: EditorView.scrollIntoView(lineInfo.from, {
          y: 'start',
          yMargin: 16
        })
      })
    }

    container.addEventListener('editor:scroll-to-line', handler)
    return () => container.removeEventListener('editor:scroll-to-line', handler)
  }, [])

  return (
    <>
      <style>{`
        .source-editor .cm-editor {
          background-color: #ffffff;
          color: #171717;
        }
        .source-editor .cm-gutters {
          background-color: #f5f5f5;
          border-right: 1px solid #e5e5e5;
        }
        .source-editor .cm-activeLine {
          background-color: #f5f5f5;
        }
        .source-editor .cm-activeLineGutter {
          background-color: #e5e5e5;
        }
        .dark .source-editor .cm-editor {
          background-color: #171717;
          color: #f5f5f5;
        }
        .dark .source-editor .cm-gutters {
          background-color: #262626;
          border-right-color: #404040;
          color: #a3a3a3;
        }
        .dark .source-editor .cm-activeLine,
        .dark .source-editor .cm-activeLineGutter {
          background-color: #262626;
        }
        .dark .source-editor .cm-cursor {
          border-left-color: #f5f5f5;
        }
        .dark .source-editor .cm-selectionBackground {
          background-color: #404040;
        }
        /* In-document find highlights — same palette as the preview mode
           so the FindBar feels consistent across the three editors. */
        .source-editor span.cm-find-match {
          background-color: #fef08a;
          color: inherit;
          border-radius: 2px;
          padding: 0 1px;
        }
        .source-editor span.cm-find-match.cm-find-active {
          background-color: #facc15;
          box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.4);
        }
        .dark .source-editor span.cm-find-match {
          background-color: rgba(250, 204, 21, 0.25);
        }
        .dark .source-editor span.cm-find-match.cm-find-active {
          background-color: rgba(250, 204, 21, 0.45);
          box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.4);
        }
      `}</style>
      <div
        ref={containerRef}
        data-editor-scroll="true"
        className="source-editor h-full w-full overflow-auto"
      />
    </>
  )
}