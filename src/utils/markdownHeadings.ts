/**
 * Parse the heading list out of a Markdown document.
 *
 * Used both by `<TocPanel>` (to render the outline) and by
 * `<SourceEditor>` (to map a visible line number back to a heading entry).
 *
 * Conventions (kept stable across the app — see `App.handleHeadingClick`):
 * - `level`         : 1..6, the number of leading `#` characters.
 * - `text`          : heading text with surrounding whitespace trimmed.
 * - `line`          : 0-indexed source line.
 * - `levelIndex`    : 0-indexed ordinal among headings of the same level.
 *
 * Headings inside fenced code blocks (```...```) are ignored.
 */
export interface ParsedHeading {
  level: number
  text: string
  line: number
  levelIndex: number
}

export function parseMarkdownHeadings(content: string): ParsedHeading[] {
  const levelCounts = new Map<number, number>()
  const result: ParsedHeading[] = []
  const lines = content.split('\n')
  let inCodeBlock = false

  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      return
    }
    if (inCodeBlock) return

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
}
