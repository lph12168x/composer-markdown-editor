import { useMemo } from 'react'
import type { Document } from '../../types/file'

export interface Heading {
  level: number
  text: string
  line: number
  levelIndex: number  // index among headings of the same level
}

interface TocPanelProps {
  document: Document | null
  onHeadingClick?: (heading: Heading) => void
}

export function TocPanel({ document, onHeadingClick }: TocPanelProps): JSX.Element {
  const headings = useMemo(() => {
    if (!document) return []

    const levelCounts = new Map<number, number>()
    const result: Heading[] = []
    const lines = document.content.split('\n')
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const levelIndex = levelCounts.get(level) || 0
        levelCounts.set(level, levelIndex + 1)
        result.push({
          level,
          text: match[2].trim(),
          line: index,
          levelIndex
        })
      }
    })
    return result
  }, [document])

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-500">
        No document open
      </div>
    )
  }

  if (headings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-500">
        No headings
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Outline
      </div>
      <ul className="space-y-1">
        {headings.map((heading, index) => (
          <li
            key={index}
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            <button
              onClick={() => onHeadingClick?.(heading)}
              className="w-full truncate text-left text-xs text-neutral-300 hover:text-blue-400"
              title={heading.text}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
