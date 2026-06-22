import { useState, useEffect, useRef } from 'react'

interface InlineRenameProps {
  initialName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function InlineRename({ initialName, onConfirm, onCancel }: InlineRenameProps): JSX.Element {
  const [value, setValue] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      onConfirm(value.trim())
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onConfirm(value.trim())}
      className="w-full rounded border border-blue-500 bg-neutral-700 px-1 py-0.5 text-sm outline-none"
    />
  )
}
