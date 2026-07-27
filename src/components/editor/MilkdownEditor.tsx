import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import type { EditorProps } from '../../types/editor'
import '../../styles/milkdown-theme/common/style.css'
import '../../styles/milkdown-theme/nord/style.css'
import '../../styles/milkdown-theme/dark/style.css'
import type { FindController } from './FindBar'

export interface MilkdownEditorProps extends EditorProps {
  /**
   * Called once with a `FindController` backed by a DOM walker that
   * creates CSS Custom Highlight Ranges for matches. The FindBar drives
   * search through this controller; the editor handles highlight +
   * scroll + count internally.
   *
   * ProseMirror replaces text nodes on re-render, which invalidates
   * Range objects. A MutationObserver re-creates the ranges (debounced)
   * so highlights survive editing while the bar is open.
   */
  onFindController?: (controller: FindController) => void
}

export function MilkdownEditor({ content, onChange, onFindController }: MilkdownEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialContentRef = useRef(content)
  const onChangeRef = useRef(onChange)
  const onFindControllerRef = useRef(onFindController)
  // Find state for the in-editor FindBar. Lifted to the top of the
  // component so the mount effect can write into them.
  const currentQueryRef = useRef('')
  const activeIndexRef = useRef(0)
  // Set right before next/prev triggers `scrollIntoView`, so the
  // MutationObserver callback (which fires as a side-effect of the
  // ProseMirror measure pass) can skip re-applying the query for the
  // ~80ms it takes the editor to settle. Otherwise the re-apply resets
  // `activeIndex` to 0 and subsequent Enter presses always land on the
  // first match.
  const scrollGuardUntilRef = useRef(0)
  // Re-entrancy guard. applyFind registers CSS Highlights and calls
  // scrollIntoView; a synchronous re-entry from the MutationObserver
  // would form a tight loop. The guard short-circuits any re-entry
  // while we are still unwinding; it is reset in applyFind's finally
  // block.
  const applyingRef = useRef(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onFindControllerRef.current = onFindController
  }, [onFindController])

  /**
   * Walk text nodes inside the editor container and create a CSS Custom
   * Highlight (Range-based) for every case-insensitive occurrence of
   * `query`. The active match gets a second highlight group so it can
   * be styled differently.
   *
   * Unlike <span> wrappers, CSS Highlight Ranges don't modify the DOM,
   * so ProseMirror's reconciler can't strip them — the original
   * contenteditable="false" approach was stripped on every ProseMirror
   * view update, making highlights invisible.
   */
  const matchRangesRef = useRef<Range[]>([])
  const applyFind = (query: string): number => {
    const containerEl = containerRef.current
    if (!containerEl) return 0
    if (applyingRef.current) return 0
    applyingRef.current = true
    try {

    // 1) Clear previous highlights.
    CSS.highlights.delete('milkdown-find-match')
    CSS.highlights.delete('milkdown-find-active')
    matchRangesRef.current = []

    if (!query) return 0
    const needle = query.toLowerCase()
    if (!needle) return 0

    // 2) Walk text nodes and create a Range for each match.
    const treeWalker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT)
    const ranges: Range[] = []
    let n: Node | null = treeWalker.nextNode()
    while (n) {
      if (n instanceof Text && n.nodeValue && n.nodeValue.toLowerCase().includes(needle)) {
        const original = n.nodeValue
        const haystack = original.toLowerCase()
        let cursor = 0
        while (cursor < haystack.length) {
          const hit = haystack.indexOf(needle, cursor)
          if (hit < 0) break
          const range = document.createRange()
          range.setStart(n, hit)
          range.setEnd(n, hit + needle.length)
          ranges.push(range)
          cursor = hit + Math.max(1, needle.length)
        }
      }
      n = treeWalker.nextNode()
    }

    if (ranges.length === 0) return 0
    matchRangesRef.current = ranges

    // 3) Register all matches + active match as CSS Highlight groups.
    const matchHighlight = new Highlight(...ranges)
    CSS.highlights.set('milkdown-find-match', matchHighlight)

    const idx = ((activeIndexRef.current % ranges.length) + ranges.length) % ranges.length
    CSS.highlights.set('milkdown-find-active', new Highlight(ranges[idx]))

    // 4) Scroll active match into view.
    ranges[idx].startContainer.parentElement?.scrollIntoView({ behavior: 'auto', block: 'center' })

    return ranges.length
    } finally {
      applyingRef.current = false
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const crepe = new Crepe({
      root: container,
      defaultValue: initialContentRef.current,
      features: {
        [Crepe.Feature.TopBar]: true
      }
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_, markdown) => {
        onChangeRef.current(markdown)
      })
    })

    void crepe.create()

    // Publish the FindController after a few frames so ProseMirror has
    // mounted and rendered the document body.
    let mo: MutationObserver | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const publish = (): void => {
      const cb = onFindControllerRef.current
      if (!cb) return
      const controller: FindController = {
        search(query) {
          currentQueryRef.current = query
          activeIndexRef.current = 0
          return applyFind(query)
        },
        next() {
          if (!currentQueryRef.current) return 0
          const ranges = matchRangesRef.current
          if (ranges.length === 0) return 0
          activeIndexRef.current = (activeIndexRef.current + 1) % ranges.length
          const idx = activeIndexRef.current
          CSS.highlights.set('milkdown-find-active', new Highlight(ranges[idx]))
          scrollGuardUntilRef.current = Date.now() + 120
          ranges[idx].startContainer.parentElement?.scrollIntoView({ behavior: 'auto', block: 'center' })
          return activeIndexRef.current + 1
        },
        prev() {
          if (!currentQueryRef.current) return 0
          const ranges = matchRangesRef.current
          if (ranges.length === 0) return 0
          activeIndexRef.current = (activeIndexRef.current - 1 + ranges.length) % ranges.length
          const idx = activeIndexRef.current
          CSS.highlights.set('milkdown-find-active', new Highlight(ranges[idx]))
          scrollGuardUntilRef.current = Date.now() + 120
          ranges[idx].startContainer.parentElement?.scrollIntoView({ behavior: 'auto', block: 'center' })
          return activeIndexRef.current + 1
        },
        close() {
          currentQueryRef.current = ''
          activeIndexRef.current = 0
          applyFind('')
        }
      }
      cb(controller)

      // ProseMirror replaces text nodes on re-render, which invalidates
      // our Range objects. Re-create the ranges (debounced) so highlights
      // survive editing while the bar is open. Since CSS Highlights don't
      // modify the DOM, the only mutations we observe are ProseMirror's
      // own — no feedback loop.
      //
      // Skip the re-apply for the brief window after a user-driven
      // scrollIntoView() (called by next/prev) so activeIndex isn't
      // reset to 0.
      mo = new MutationObserver(() => {
        if (!currentQueryRef.current) return
        if (applyingRef.current) return
        if (Date.now() < scrollGuardUntilRef.current) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          if (!currentQueryRef.current) return
          if (applyingRef.current) return
          applyFind(currentQueryRef.current)
        }, 50)
      })
      mo.observe(container, { childList: true, subtree: true, characterData: true })
    }
    // Crepe mounts asynchronously; publish on the next two frames to
    // cover the common case where `.ProseMirror` is built on the first
    // tick but its children arrive on the second.
    const raf1 = requestAnimationFrame(publish)
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(publish))

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      if (debounceTimer) clearTimeout(debounceTimer)
      mo?.disconnect()
      CSS.highlights.delete('milkdown-find-match')
      CSS.highlights.delete('milkdown-find-active')
      void crepe.destroy()
    }
  }, [])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      data-editor-scroll="true"
      className={`milkdown h-full w-full overflow-auto ${isDark ? 'dark' : ''}`}
    />
  )
}
