import { useState } from 'react'
import type { FileRef } from '../../types/file'

interface ContextMenuProps {
  x: number
  y: number
  ref: FileRef
  onClose: () => void
  onNewFile: () => void
  onNewFolder: () => void
  onRename: () => void
  onDelete: () => void
}

export function ContextMenu({
  x,
  y,
  ref,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete
}: ContextMenuProps): JSX.Element {
  const [showDanger, setShowDanger] = useState(false)

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded border border-neutral-600 bg-neutral-800 py-1 shadow-lg"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      {ref.isDirectory && (
        <>
          <button
            onClick={() => {
              onNewFile()
              onClose()
            }}
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-700"
          >
            New File
          </button>
          <button
            onClick={() => {
              onNewFolder()
              onClose()
            }}
            className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-700"
          >
            New Folder
          </button>
          <div className="my-1 border-t border-neutral-600" />
        </>
      )}
      <button
        onClick={() => {
          onRename()
          onClose()
        }}
        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-700"
      >
        Rename
      </button>
      <button
        onClick={() => setShowDanger(true)}
        className="block w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-neutral-700"
      >
        Delete
      </button>

      {showDanger && (
        <div className="border-t border-neutral-600 px-3 py-2">
          <p className="mb-2 text-xs text-neutral-400">
            Delete {ref.isDirectory ? 'folder' : 'file'} "{ref.name}"?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowDanger(false)}
              className="flex-1 rounded bg-neutral-600 px-2 py-1 text-xs text-white hover:bg-neutral-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
