import { useEffect, useRef } from 'react'
import markdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'
import type { FileRef } from '../../types/file'
import { fileSystemClient } from '../../services/fileSystemClient'

interface MarkdownPreviewProps {
  content: string
  baseRef?: FileRef
}

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true
})

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
    ]
  })
}

function resolveSvgPath(src: string, baseRef?: FileRef): string | null {
  if (!baseRef) return null
  if (/^(https?:|data:|file:|\/)/i.test(src)) return null
  if (!src.toLowerCase().endsWith('.svg')) return null

  const separator = baseRef.type === 'ssh' ? '/' : /[/\\]/
  const baseParts = baseRef.path.split(separator).filter((part) => part.length > 0)
  baseParts.pop() // remove file name, keep directory

  // Windows absolute drive handling
  if (baseParts[0] && /^[a-zA-Z]:$/.test(baseParts[0])) {
    return `${baseParts[0]}\\${[...baseParts.slice(1), ...src.split(/[/\\]/).filter(Boolean)].join('\\')}`
  }

  const relativeParts = src.split('/').filter((part) => part.length > 0)
  const resolved = [...baseParts, ...relativeParts]
  return baseRef.type === 'ssh' ? '/' + resolved.join('/') : resolved.join('/')
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

    const svgPath = resolveSvgPath(src, baseRef)
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

export function MarkdownPreview({ content, baseRef }: MarkdownPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    const render = async (): Promise<void> => {
      const rawHtml = md.render(content)
      const temp = document.createElement('div')
      temp.innerHTML = rawHtml

      await renderMermaidBlocks(temp)
      if (cancelled) return

      await inlineSvgImages(temp, baseRef)
      if (cancelled) return

      const sanitized = sanitizeHtml(temp.innerHTML)
      if (cancelled) return

      container.innerHTML = sanitized
    }

    void render()

    return () => {
      cancelled = true
    }
  }, [content, baseRef])

  return (
    <div
      ref={containerRef}
      data-editor-scroll="true"
      className="markdown-preview h-full w-full overflow-auto bg-neutral-50 p-6 text-neutral-900"
    />
  )
}
