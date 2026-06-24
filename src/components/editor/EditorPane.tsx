import { useEffect, useCallback } from 'react'
import { Eye, FileCode, Pencil, GitCompare } from 'lucide-react'
import { useDocumentStore } from '../../stores/fileStore'
import { useUiStore } from '../../stores/uiStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { SourceEditor } from './SourceEditor'
import { DiffViewer } from './DiffViewer'
import { StatusBar } from './StatusBar'

export function EditorPane(): JSX.Element {
  const { document, updateContent, updateRawContent, enterSourceMode, markSaved } = useDocumentStore()
  const { editorMode, diffTarget, setEditorMode } = useUiStore()

  const handleSave = useCallback(async () => {
    if (!document || !document.modified) return

    try {
      await fileSystemClient.writeFile(document.ref, document.content)
      markSaved(document.content)
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

  useEffect(() => {
    if (editorMode === 'source') {
      enterSourceMode()
    }
  }, [editorMode, enterSourceMode])

  return (
    <div className="flex h-full flex-col" data-editor-pane="true">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Editor
        </span>
        <div className="flex items-center gap-1 rounded bg-neutral-100 p-0.5">
          <button
            onClick={() => setEditorMode('source')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              editorMode === 'source'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            title="Source mode"
          >
            <FileCode size={12} />
            Source
          </button>
          <button
            onClick={() => setEditorMode('preview')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              editorMode === 'preview'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            title="Preview mode"
          >
            <Eye size={12} />
            Preview
          </button>
          <button
            onClick={() => setEditorMode('edit')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              editorMode === 'edit'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
            title="Edit mode"
          >
            <Pencil size={12} />
            Edit
          </button>
          {diffTarget && (
            <button
              onClick={() => setEditorMode('diff')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                editorMode === 'diff'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="Diff view"
            >
              <GitCompare size={12} />
              Diff
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {editorMode === 'diff' ? (
          <DiffViewer />
        ) : document ? (
          editorMode === 'edit' ? (
            <MarkdownEditor key={document.ref.id} content={document.content} onChange={updateContent} />
          ) : editorMode === 'preview' ? (
            <MarkdownPreview content={document.content} baseRef={document.ref} />
          ) : (
            <SourceEditor key={document.ref.id} content={document.rawContent} onChange={updateRawContent} />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            Open a folder and double-click a .md file to edit
          </div>
        )}
      </div>
      <StatusBar document={document} />
    </div>
  )
}
