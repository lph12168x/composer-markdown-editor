import type { Document } from '../../types/file'

interface StatusBarProps {
  document: Document | null
}

export function StatusBar({ document }: StatusBarProps): JSX.Element {
  if (!document) {
    return (
      <div className="flex h-7 items-center border-t border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-500">
        No file open
      </div>
    )
  }

  return (
    <div className="flex h-7 items-center justify-between border-t border-neutral-700 bg-neutral-800 px-3 text-xs">
      <span className="truncate text-neutral-400">{document.ref.path}</span>
      <div className="flex items-center gap-3">
        <span className={document.modified ? 'text-yellow-500' : 'text-green-500'}>
          {document.modified ? 'Modified' : 'Saved'}
        </span>
        <span className="text-neutral-500">
          {document.content.length} chars
        </span>
      </div>
    </div>
  )
}
