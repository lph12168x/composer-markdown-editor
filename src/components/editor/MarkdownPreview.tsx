import { useEffect, useRef } from 'react'
import markdownIt from 'markdown-it'
import markdownItContainer from 'markdown-it-container'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'
import hljs from 'highlight.js/lib/common'
import type { FileRef } from '../../types/file'
import { fileSystemClient } from '../../services/fileSystemClient'
import '../../styles/markdown-preview.css'
import type { FindController } from './FindBar'

interface MarkdownPreviewProps {
  content: string
  baseRef?: FileRef
  /**
   * Called once when the preview is ready with a `FindController` backed
   * by a DOM walker that wraps matches in `<span class="editor-find-match">`.
   * The FindBar calls these methods to drive in-document search.
   */
  onFindController?: (controller: FindController) => void
}

// Independent escape helper so the highlight() callback doesn't have to
// reference `md` inside its own initializer (which would trip
// `noImplicitAny`).
const escapeHtml = (input: string): string =>
  input.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // Run fenced code blocks through highlight.js when a known language is
  // requested. We return the full <pre><code> wrapper so the hljs theme CSS
  // can match on `.hljs` (hljs needs the class on the root element to apply
  // its token colors). For unknown languages we still wrap with the hljs
  // class so the theme's base background/text colors apply, then fall back
  // to a basic HTML escape. `mermaid` is intentionally NOT routed through
  // hljs — it is consumed later by `renderMermaidBlocks`, which looks up
  // blocks via `pre code.language-mermaid`.
  highlight: (str, lang) => {
    if (lang === 'mermaid') {
      return `<pre class="hljs"><code class="hljs language-mermaid">${escapeHtml(str)}</code></pre>`
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const result = hljs.highlight(str, { language: lang, ignoreIllegals: true })
        return `<pre class="hljs"><code class="hljs language-${lang}">${result.value}</code></pre>`
      } catch {
        // Fall through to the escaped default below.
      }
    }
    return `<pre class="hljs"><code class="hljs${lang ? ` language-${lang}` : ''}">${escapeHtml(str)}</code></pre>`
  }
})

/**
 * GitHub-style slug for heading anchors. Keeps the existing in-document
 * anchor stable (same input → same id), preserves CJK characters, and
 * de-duplicates collisions by appending `-1`, `-2`, ... in document order.
 */
function slugify(text: string): string {
  // Strip markdown syntax roughly so the rendered text becomes the anchor
  // base. We don't try to be perfect — markdown-it doesn't expose the
  // plain-text rendering of inline tokens here without a full pass.
  const stripped = text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
  return stripped || 'section'
}

const usedSlugs = new Set<string>()
function uniqueSlug(text: string): string {
  const base = slugify(text)
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base)
    return base
  }
  let n = 1
  while (usedSlugs.has(`${base}-${n}`)) n += 1
  const out = `${base}-${n}`
  usedSlugs.add(out)
  return out
}

// Override heading_open to emit a stable `id` on every <hN>. The matching
// inline tokens follow and contain the heading text; we resolve the slug
// from those. Token stream is walked forward from `idx` to find the next
// `inline` token belonging to this heading.
const defaultHeadingOpen = md.renderer.rules.heading_open
  ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
  const openToken = tokens[idx]
  const inlineToken = tokens[idx + 1]
  const text = inlineToken && inlineToken.type === 'inline'
    ? inlineToken.content
    : ''
  const id = uniqueSlug(text)
  // Splice the id onto the opening tag so DOMPurify keeps it (id is in
  // ADD_ATTR already).
  openToken.attrJoin('id', id)
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

/** Reset slug collision tracker at the start of each render. */
function resetHeadingSlugState(): void {
  usedSlugs.clear()
}

const ADMONITION_TYPES = ['tip', 'warning', 'danger', 'info', 'details']

for (const name of ADMONITION_TYPES) {
  md.use(markdownItContainer, name, {
    render(tokens, idx) {
      const token = tokens[idx]
      const title = token.info.trim().slice(name.length).trim() || name.toUpperCase()

      if (token.nesting === 1) {
        return `<div class="admonition admonition-${name}"><p class="admonition-title">${md.utils.escapeHtml(title)}</p>\n`
      }
      return '</div>\n'
    }
  })
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: 'default',
  htmlLabels: false
})

const SVG_MAX_SIZE = 1024 * 1024 // 1 MiB

function sanitizeHtml(html: string): string {
  const purifier = DOMPurify(window)
  return purifier.sanitize(html, {
    ADD_TAGS: [
      'svg',
      'g',
      'defs',
      'marker',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'path',
      'text',
      'textPath',
      'tspan',
      'use',
      'foreignObject',
      'title',
      'desc',
      'style'
    ],
    ADD_ATTR: [
      'xmlns',
      'xmlns:xlink',
      'viewBox',
      'class',
      'style',
      'id',
      'transform',
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'marker-end',
      'marker-start',
      'd',
      'x',
      'y',
      'x1',
      'y1',
      'x2',
      'y2',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'points',
      'width',
      'height',
      'text-anchor',
      'dominant-baseline',
      'font-size',
      'font-family',
      'font-weight',
      'fill-opacity',
      'stroke-opacity',
      'dy'
    ],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    // Mark SVG `d` (path data) as URI-safe so DOMPurify does not reject it
    // through the URL regex. Without this, mermaid/flowchart edge paths lose
    // their `d` attribute during sanitize and the connectors disappear.
    ADD_URI_SAFE_ATTR: ['d']
  })
}

function resolveImagePath(src: string, baseRef?: FileRef): string | null {
  if (!baseRef) return null
  if (/^(https?:|data:|file:|\/)/i.test(src)) return null

  const isAbsoluteUnix = baseRef.path.startsWith('/')
  const separator = baseRef.type === 'ssh' ? '/' : /[/\\]/
  const baseParts = baseRef.path.split(separator).filter((part) => part.length > 0)
  baseParts.pop() // remove file name, keep directory

  // Windows absolute drive handling
  if (baseParts[0] && /^[a-zA-Z]:$/.test(baseParts[0])) {
    return `${baseParts[0]}\\${[...baseParts.slice(1), ...src.split(/[/\\]/).filter(Boolean)].join('\\')}`
  }

  const relativeParts = src.split('/').filter((part) => part.length > 0)
  const resolved = [...baseParts, ...relativeParts]
  return baseRef.type === 'ssh' || isAbsoluteUnix ? '/' + resolved.join('/') : resolved.join('/')
}

async function renderMermaidBlocks(container: HTMLElement): Promise<void> {
  const blocks = container.querySelectorAll('pre code.language-mermaid')
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const code = block.textContent || ''
    const id = `mermaid-${Date.now()}-${i}`
    try {
      const { svg } = await mermaid.render(id, code)
      const wrapper = document.createElement('div')
      wrapper.className = 'mermaid-diagram my-4 flex justify-center'
      wrapper.innerHTML = svg
      const pre = block.closest('pre')
      if (pre && pre.parentNode) {
        pre.parentNode.replaceChild(wrapper, pre)
      }
    } catch (err) {
      console.error('Failed to render mermaid diagram:', err)
      const errorDiv = document.createElement('div')
      errorDiv.className =
        'my-2 rounded border border-red-800 bg-red-900/20 p-2 text-xs text-red-400'
      errorDiv.textContent = 'Failed to render Mermaid diagram'
      const pre = block.closest('pre')
      if (pre && pre.parentNode) {
        pre.parentNode.replaceChild(errorDiv, pre)
      }
    }
  }
}

async function inlineSvgImages(container: HTMLElement, baseRef?: FileRef): Promise<void> {
  if (!baseRef) return

  const images = container.querySelectorAll('img')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (!src) continue
    if (!src.toLowerCase().endsWith('.svg')) continue

    const svgPath = resolveImagePath(src, baseRef)
    if (!svgPath) continue

    try {
      const svgContent = await fileSystemClient.readFile({
        ...baseRef,
        path: svgPath,
        name: svgPath.split(/[/\\]/).pop() || svgPath,
        id: `${baseRef.rootId}:${svgPath}`,
        isDirectory: false
      })

      if (svgContent.length > SVG_MAX_SIZE) {
        console.warn(`SVG file too large: ${src}`)
        continue
      }

      const wrapper = document.createElement('span')
      wrapper.innerHTML = svgContent
      const svgElement = wrapper.querySelector('svg')
      if (svgElement) {
        svgElement.setAttribute('class', 'max-w-full h-auto')
        img.parentNode?.replaceChild(svgElement, img)
      }
    } catch (err) {
      console.error(`Failed to load SVG ${src}:`, err)
    }
  }
}

async function inlineRasterImages(container: HTMLElement, baseRef?: FileRef): Promise<void> {
  if (!baseRef) return

  const images = container.querySelectorAll('img')
  for (const img of images) {
    const src = img.getAttribute('src')
    if (!src) continue
    if (src.toLowerCase().endsWith('.svg')) continue

    const imagePath = resolveImagePath(src, baseRef)
    if (!imagePath) continue

    try {
      const dataUrl = await fileSystemClient.readFileAsDataUrl({
        ...baseRef,
        path: imagePath,
        name: imagePath.split(/[/\\]/).pop() || imagePath,
        id: `${baseRef.rootId}:${imagePath}`,
        isDirectory: false
      })
      img.setAttribute('src', dataUrl)
    } catch (err) {
      console.error(`Failed to load image ${src}:`, err)
    }
  }
}

export function MarkdownPreview({ content, baseRef, onFindController }: MarkdownPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  // Latest find query — re-applied automatically after each re-render so
  // search highlights survive content updates (e.g. mermaid swap-in).
  const currentQueryRef = useRef('')
  const activeIndexRef = useRef(0)
  // Re-entrancy guard. applyFind mutates the DOM (replaceChild +
  // scrollIntoView) which can re-trigger the render effect's applyFind
  // call (line 337). The guard short-circuits any re-entry while a
  // previous applyFind is still on the stack, eliminating the
  // synchronous re-entry loop. The render-effect call site is also
  // guarded by this flag, so a re-render during an in-flight applyFind
  // will skip the re-apply rather than queue a second one.
  const applyingRef = useRef(false)
  // Latest onFindController callback so the render effect can publish
  // a fresh controller whenever the DOM is rebuilt.
  const onFindControllerRef = useRef(onFindController)
  useEffect(() => {
    onFindControllerRef.current = onFindController
  }, [onFindController])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    const render = async (): Promise<void> => {
      // Slug uniqueness is per-render; reset before each pass so the same
      // document re-rendered with the same content gets the same ids.
      resetHeadingSlugState()
      const rawHtml = md.render(content)
      const temp = document.createElement('div')
      temp.innerHTML = rawHtml

      await renderMermaidBlocks(temp)
      if (cancelled) return

      await inlineSvgImages(temp, baseRef)
      if (cancelled) return

      await inlineRasterImages(temp, baseRef)
      if (cancelled) return

      const sanitized = sanitizeHtml(temp.innerHTML)
      if (cancelled) return

      container.innerHTML = sanitized

      // After a fresh render, re-publish the FindController so it captures
      // the new container, and re-apply the active query so highlights
      // persist across re-renders (e.g. mermaid swap-in).
      publishFindController()
      if (currentQueryRef.current && !applyingRef.current) {
        applyFind(currentQueryRef.current)
      }
    }

    /**
     * Scroll the given match element to the vertical center of the preview
     * container. `Element.scrollIntoView({ block: 'center' })` also scrolls
     * ancestor scroll containers (the window, layout panels), which in this
     * Electron app produces no visible movement in the intended container
     * or jumps the whole page. Scrolling the container directly with a
     * computed offset is reliable and mirrors the anchor-click handler.
     * `behavior: 'smooth'` is silently ignored by the Chromium version
     * bundled with Electron, so we use `'auto'` for an instant jump.
     */
    const scrollMatchIntoView = (el: HTMLElement): void => {
      const containerEl = containerRef.current
      if (!containerEl) return
      const containerRect = containerEl.getBoundingClientRect()
      const matchTop = el.getBoundingClientRect().top - containerRect.top
      const target = containerEl.scrollTop + matchTop - containerEl.clientHeight / 2
      const maxScroll = Math.max(0, containerEl.scrollHeight - containerEl.clientHeight)
      containerEl.scrollTo({ top: Math.max(0, Math.min(target, maxScroll)), behavior: 'auto' })
    }

    /**
     * Walk all text nodes inside the container, wrap every case-insensitive
     * occurrence of `query` in a `<span class="editor-find-match">`, and
     * mark the active match with an additional `editor-find-active` class.
     * Unwraps any previously inserted marks first so consecutive searches
     * don't nest.
     */
    const applyFind = (query: string): number => {
      const containerEl = containerRef.current
      if (!containerEl) return 0
      // Re-entrancy guard: see the comment on `applyingRef` above.
      if (applyingRef.current) return 0
      applyingRef.current = true
      try {

      // 1) Unwrap previous marks in document order so we don't accumulate
      //    nested <span> elements across searches. Done before the empty-
      //    query early return so `close()` → `applyFind('')` clears
      //    existing highlights instead of leaving them on screen.
      const oldMarks = Array.from(containerEl.querySelectorAll('span.editor-find-match'))
      for (const mark of oldMarks) {
        const parent = mark.parentNode
        if (!parent) continue
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark)
        }
        parent.removeChild(mark)
        parent.normalize()
      }

      if (!query) return 0
      // 2) Walk text nodes and wrap matches. We can't simply do
      //    `container.innerHTML.replace(...)` because that would re-parse
      //    the DOM and clobber any pending mermaid/svg nodes that finished
      //    rendering after our initial innerHTML assignment.
      const needle = query.toLowerCase()
      if (!needle) return 0

      const treeWalker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let node: Node | null = treeWalker.nextNode()
      while (node) {
        if (node instanceof Text && node.nodeValue && node.nodeValue.toLowerCase().includes(needle)) {
          textNodes.push(node)
        }
        node = treeWalker.nextNode()
      }

      for (const text of textNodes) {
        const original = text.nodeValue ?? ''
        const haystack = original.toLowerCase()
        let cursor = 0
        let firstHitAt: number | null = null
        while (cursor < haystack.length) {
          const hit = haystack.indexOf(needle, cursor)
          if (hit < 0) break
          if (firstHitAt === null) firstHitAt = hit
          cursor = hit + Math.max(1, needle.length)
        }
        if (firstHitAt === null) continue

        // Build replacement nodes: a sequence of text nodes interleaved
        // with <mark> wrappers. Done in one pass to keep DOM mutation cheap.
        const fragment = document.createDocumentFragment()
        let pos = 0
        cursor = 0
        while (cursor < haystack.length) {
          const hit = haystack.indexOf(needle, cursor)
          if (hit < 0) {
            fragment.appendChild(document.createTextNode(original.slice(pos)))
            break
          }
          if (hit > pos) fragment.appendChild(document.createTextNode(original.slice(pos, hit)))
          const mark = document.createElement('span')
          mark.className = 'editor-find-match'
          mark.textContent = original.slice(hit, hit + needle.length)
          fragment.appendChild(mark)
          pos = hit + needle.length
          cursor = pos
        }
        text.parentNode?.replaceChild(fragment, text)
      }

      // 3) Highlight the active match (if any) and scroll it into view.
      const marks = Array.from(containerEl.querySelectorAll('span.editor-find-match'))
      if (marks.length === 0) return 0
      const idx = ((activeIndexRef.current % marks.length) + marks.length) % marks.length
      const active = marks[idx] as HTMLElement
      active.classList.add('editor-find-active')
      scrollMatchIntoView(active)
      return marks.length
      } finally {
        applyingRef.current = false
      }
    }

    /**
     * Move the active-match indicator without rebuilding marks. Cheap path
     * for `next`/`prev` once the highlights already exist.
     */
    const setActive = (total: number): void => {
      const containerEl = containerRef.current
      if (!containerEl || total === 0) return
      const marks = containerEl.querySelectorAll('span.editor-find-match')
      const idx = ((activeIndexRef.current % total) + total) % total
      const active = marks[idx] as HTMLElement | undefined
      if (!active) return
      scrollMatchIntoView(active)
      active.classList.add('editor-find-active')
    }

    const publishFindController = (): void => {
      const callback = onFindControllerRef.current
      if (!callback) return
      const controller: FindController = {
        search(query) {
          currentQueryRef.current = query
          activeIndexRef.current = 0
          return applyFind(query)
        },
        next() {
          if (!currentQueryRef.current) return 0
          const containerEl = containerRef.current
          if (!containerEl) return 0
          const total = containerEl.querySelectorAll('span.editor-find-match').length
          if (total === 0) return 0
          // Drop the previous-active class, advance the cursor, highlight.
          containerEl.querySelectorAll('span.editor-find-active').forEach((m) => {
            m.classList.remove('editor-find-active')
          })
          activeIndexRef.current = (activeIndexRef.current + 1) % total
          setActive(total)
          return activeIndexRef.current + 1
        },
        prev() {
          if (!currentQueryRef.current) return 0
          const containerEl = containerRef.current
          if (!containerEl) return 0
          const total = containerEl.querySelectorAll('span.editor-find-match').length
          if (total === 0) return 0
          containerEl.querySelectorAll('span.editor-find-active').forEach((m) => {
            m.classList.remove('editor-find-active')
          })
          activeIndexRef.current =
            (activeIndexRef.current - 1 + total) % total
          setActive(total)
          return activeIndexRef.current + 1
        },
        close() {
          currentQueryRef.current = ''
          activeIndexRef.current = 0
          applyFind('')
        }
      }
      callback(controller)
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [content, baseRef])

  /**
   * In-page anchor clicks: markdown renders `[text](#some-id)` as
   * `<a href="#some-id">…</a>`. Without interception the browser jumps
   * abruptly to the anchor and may leave the page scrolled above the
   * editor's own scroll container. We intercept hash links and scroll the
   * editor itself smoothly to the matching heading element.
   *
   * Using event delegation on the container so we don't need to re-bind
   * after every re-render.
   */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return

      const href = anchor.getAttribute('href') ?? ''
      // Only intercept in-page hash links; leave external links to the
      // browser (we may add an open-in-new-tab affordance later).
      if (!href.startsWith('#') || href.length < 2) return

      const id = decodeURIComponent(href.slice(1))
      const heading = container.querySelector(`#${CSS.escape(id)}`)
      if (!(heading instanceof HTMLElement)) return

      event.preventDefault()
      // Offset 16px mirrors `App.handleHeadingClick` for the right-side
      // outline, so the two entry points land the heading at the same
      // visual position.
      const containerRect = container.getBoundingClientRect()
      const targetTop = heading.getBoundingClientRect().top - containerRect.top
      const scrollTop = container.scrollTop + targetTop - 16
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'auto' })
      // Update the URL hash so the location bar reflects the destination —
      // useful for "copy link" workflows and back-button navigation.
      try {
        window.history.replaceState(null, '', `#${id}`)
      } catch {
        // replaceState can throw on file:// in some Electron versions; safe to ignore.
      }
    }

    container.addEventListener('click', handleClick)
    return () => container.removeEventListener('click', handleClick)
  }, [])

  return (
    <div
      ref={containerRef}
      data-editor-scroll="true"
      className="markdown-preview h-full w-full overflow-auto bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
    />
  )
}
