import { useMemo } from 'react'
import type { Document } from '../../types/file'
import { parseMarkdownHeadings, type ParsedHeading } from '../../utils/markdownHeadings'

export type { ParsedHeading as Heading } from '../../utils/markdownHeadings'
type Heading = ParsedHeading

interface TocPanelProps {
  document: Document | null
  onHeadingClick?: (heading: Heading) => void
  /**
   * The heading currently visible at the top of the editor scroller.
   * Pass `null` or omit to disable highlighting (e.g. while clicking the
   * outline jumps the body before the observer settles).
   */
  activeHeading?: Heading | null
}

/** Stable identity for a heading entry. Matches the DOM lookup the App uses. */
function headingKey(h: Pick<Heading, 'level' | 'levelIndex'>): string {
  return `${h.level}:${h.levelIndex}`
}

export function TocPanel({
  document,
  onHeadingClick,
  activeHeading
}: TocPanelProps): JSX.Element {
  const headings = useMemo(
    () => (document ? parseMarkdownHeadings(document.content) : []),
    [document]
  )

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-400 dark:text-neutral-500">
        No document open
      </div>
    )
  }

  if (headings.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-400 dark:text-neutral-500">
        No headings
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Outline
      </div>
      <ul className="space-y-1">
        {headings.map((heading, index) => {
          const isActive =
            activeHeading != null && headingKey(heading) === headingKey(activeHeading)
          return (
            <li
              key={index}
              style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
            >
              <button
                onClick={() => onHeadingClick?.(heading)}
                className={`w-full truncate text-left text-xs ${
                  isActive
                    ? 'font-medium text-blue-600 dark:text-blue-400'
                    : 'text-neutral-700 hover:text-blue-600 dark:text-neutral-300 dark:hover:text-blue-400'
                }`}
                title={heading.text}
              >
                {heading.text}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
