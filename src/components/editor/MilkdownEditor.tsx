import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import type { EditorProps } from '../../types/editor'
import '../../styles/milkdown-theme/common/style.css'
import '../../styles/milkdown-theme/nord/style.css'
import '../../styles/milkdown-theme/dark/style.css'
import type { FindController } from './FindBar'

export interface MilkdownEditorProps extends EditorProps {
  /**
   * Called once with a `FindController` backed by a DOM walker that wraps
   * matches in `<mark class="editor-find-match">`. The FindBar drives
   * search through this controller; the editor handles highlight +
   * scroll + count internally.
   *
   * Note: ProseMirror re-renders nodes as the user types, which can wipe
   * our `<mark>` wrappers. The walker reapplies the active query via
   * MutationObserver so highlights re-attach automatically after edit.
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
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onFindControllerRef.current = onFindController
  }, [onFindController])

  /**
   * Walk text nodes inside the editor container and wrap every case-
   * insensitive occurrence of `query` in `<mark class="editor-find-match">`.
   * Marks the active match with `editor-find-active`. Unwraps any
   * previously inserted marks so consecutive searches don't nest.
   *
   * Side notes specific to Milkdown:
   * - The walker operates on `containerRef.current` which contains the
   *   `.ProseMirror` subtree; ProseMirror's reactive DOM updates can
   *   wipe our marks, so we also run on every subtree mutation.
   *   - We deliberately skip `span.editor-find-match` itself when collecting
   *   text nodes so we don't double-wrap when an old mark survives a
   *   ProseMirror re-render.
   */
  const applyFind = (query: string): number => {
    const containerEl = containerRef.current
    if (!containerEl) return 0

    // 1) Unwrap previous marks.
    const oldMarks = Array.from(containerEl.querySelectorAll('span.editor-find-match'))
    for (const mark of oldMarks) {
      const parent = mark.parentNode
      if (!parent) continue
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
      parent.removeChild(mark)
      parent.normalize()
    }

    if (!query) return 0
    const needle = query.toLowerCase()
    if (!needle) return 0

    // 2) Find candidate text nodes via TreeWalker (excludes elements
    //    whose subtree is irrelevant, e.g. our own <mark> mid-search).
    const treeWalker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let n: Node | null = treeWalker.nextNode()
    while (n) {
      if (n instanceof Text && n.nodeValue && n.nodeValue.toLowerCase().includes(needle)) {
        textNodes.push(n)
      }
      n = treeWalker.nextNode()
    }

    // 3) Wrap matches in each text node. The whole subtree is replaced via
    //    DocumentFragment so we batch the DOM mutations.
    //
    //    We use `<span contenteditable="false">` rather than `<mark>`:
    //    ProseMirror's reconciler treats unknown inline elements as part
    //    of the document's text representation and will *strip* the
    //    wrapper the next time it rebuilds the DOM for the surrounding
    //    node — at which point `next()` would find zero matches and the
    //    jump would silently no-op. `contenteditable="false"` is one of
    //    the few inline attributes that ProseMirror's parser explicitly
    //    preserves across re-renders, so the wrapper survives even
    //    when the user types inside the document.
    for (const text of textNodes) {
      const original = text.nodeValue ?? ''
      const haystack = original.toLowerCase()
      const fragment = document.createDocumentFragment()
      let pos = 0
      let cursor = 0
      while (cursor < haystack.length) {
        const hit = haystack.indexOf(needle, cursor)
        if (hit < 0) {
          fragment.appendChild(document.createTextNode(original.slice(pos)))
          break
        }
        if (hit > pos) fragment.appendChild(document.createTextNode(original.slice(pos, hit)))
        const mark = document.createElement('span')
        mark.className = 'editor-find-match'
        mark.setAttribute('contenteditable', 'false')
        mark.textContent = original.slice(hit, hit + needle.length)
        fragment.appendChild(mark)
        pos = hit + needle.length
        cursor = pos
      }
      text.parentNode?.replaceChild(fragment, text)
    }

    // 4) Set active and scroll.
    const marks = Array.from(containerEl.querySelectorAll('span.editor-find-match'))
    if (marks.length === 0) return 0
    const idx = ((activeIndexRef.current % marks.length) + marks.length) % marks.length
    const active = marks[idx] as HTMLElement
    active.classList.add('editor-find-active')
    active.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return marks.length
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
          if (!currentQueryRef.current) return
          const containerEl = containerRef.current
          if (!containerEl) return
          const total = containerEl.querySelectorAll('span.editor-find-match').length
          if (total === 0) return
          containerEl.querySelectorAll('span.editor-find-active').forEach((m) => {
            m.classList.remove('editor-find-active')
          })
          activeIndexRef.current = (activeIndexRef.current + 1) % total
          const idx = activeIndexRef.current
          const active = containerEl.querySelectorAll('span.editor-find-match')[idx] as HTMLElement | undefined
          if (active) {
            active.classList.add('editor-find-active')
            // Block the MutationObserver for the brief window ProseMirror
            // needs to settle after a scroll-induced measure pass.
            scrollGuardUntilRef.current = Date.now() + 120
            active.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        },
        prev() {
          if (!currentQueryRef.current) return
          const containerEl = containerRef.current
          if (!containerEl) return
          const total = containerEl.querySelectorAll('span.editor-find-match').length
          if (total === 0) return
          containerEl.querySelectorAll('span.editor-find-active').forEach((m) => {
            m.classList.remove('editor-find-active')
          })
          activeIndexRef.current =
            (activeIndexRef.current - 1 + total) % total
          const idx = activeIndexRef.current
          const active = containerEl.querySelectorAll('span.editor-find-match')[idx] as HTMLElement | undefined
          if (active) {
            active.classList.add('editor-find-active')
            scrollGuardUntilRef.current = Date.now() + 120
            active.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        },
        close() {
          currentQueryRef.current = ''
          activeIndexRef.current = 0
          applyFind('')
        }
      }
      cb(controller)

      // ProseMirror re-renders nodes as the user types, which can wipe
      // our <span> wrappers. Re-apply the active query on every mutation
      // (debounced) so highlights survive editing while the bar is open.
      //
      // We also skip the re-apply for the brief window after a
      // user-driven scrollIntoView() (called by next/prev), because that
      // measure pass mutates the DOM and would otherwise clobber our
      // `activeIndex` — putting the highlight cursor back at index 0
      // every time the user hits Enter. The user-driven path resets
      // `scrollGuardUntilRef` below; we honor it here.
      mo = new MutationObserver(() => {
        if (!currentQueryRef.current) return
        if (Date.now() < scrollGuardUntilRef.current) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
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
