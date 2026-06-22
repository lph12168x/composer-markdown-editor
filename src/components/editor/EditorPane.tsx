import { useEffect, useCallback } from 'react'
import { useDocumentStore } from '../../stores/fileStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { MarkdownEditor } from './MarkdownEditor'
import { StatusBar } from './StatusBar'

export function EditorPane(): JSX.Element {
  const { document, updateContent, markSaved } = useDocumentStore()

  const handleSave = useCallback(async () => {
    if (!document || !document.modified) return

    try {
      await fileSystemClient.writeFile(document.ref, document.content)
      markSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save file'
      window.alert(message)
      console.error('Failed to save file:', err)
    }
  }, [document, markSaved])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  return (
    <div className="flex h-full flex-col" data-editor-pane="true">
      <div className="flex-1 overflow-hidden">
        {document ? (
          <MarkdownEditor key={document.ref.id} content={document.content} onChange={updateContent} />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-500">
            Open a folder and double-click a .md file to edit
          </div>
        )}
      </div>
      <StatusBar document={document} />
    </div>
  )
}
