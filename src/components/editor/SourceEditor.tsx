import { useEffect, useMemo, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { EditorProps } from '../../types/editor'
import { parseMarkdownHeadings, type ParsedHeading } from '../../utils/markdownHeadings'
import type { Heading } from './TocPanel'

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

/** Extra prop on top of `EditorProps` so SourceEditor can report headings. */
export interface SourceEditorProps extends EditorProps {
  /**
   * Called with the heading currently visible at the top of the editor
   * (or `null` when there is no heading on screen). The caller is responsible
   * for any click-driven lock so the outline click that scrolled the body
   * is not clobbered by SourceEditor's own scroll-driven report.
   */
  onActiveHeadingChange?: (heading: Heading | null) => void
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
  onActiveHeadingChange
}: SourceEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onActiveHeadingChangeRef = useRef(onActiveHeadingChange)
  const headingsRef = useRef<ParsedHeading[]>([])

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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const view = new EditorView({
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        syntaxHighlighting(markdownHighlightStyle),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(view.state.doc.toString())
          }
        })
      ],
      parent: container
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Editor is created once per mount; external content changes are handled below.
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
      `}</style>
      <div
        ref={containerRef}
        data-editor-scroll="true"
        className="source-editor h-full w-full overflow-auto"
      />
    </>
  )
}