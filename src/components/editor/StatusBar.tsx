import type { Document } from '../../types/file'

interface StatusBarProps {
  document: Document | null
}

export function StatusBar({ document }: StatusBarProps): JSX.Element {
  if (!document) {
    return (
      <div className="flex h-7 items-center border-t border-neutral-200 bg-neutral-50 px-3 text-xs text-neutral-400">
        No file open
      </div>
    )
  }

  return (
    <div className="flex h-7 items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 text-xs">
      <span className="truncate text-neutral-500">{document.ref.path}</span>
      <div className="flex items-center gap-3">
        <span className={document.modified ? 'text-amber-600' : 'text-green-600'}>
          {document.modified ? 'Modified' : 'Saved'}
        </span>
        <span className="text-neutral-400">
          {document.content.length} chars
        </span>
      </div>
    </div>
  )
}
