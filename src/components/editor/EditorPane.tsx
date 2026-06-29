import { useEffect, useCallback } from 'react'
import { Eye, FileCode, Pencil, GitCompare, X } from 'lucide-react'
import { useDocumentStore } from '../../stores/fileStore'
import { useUiStore } from '../../stores/uiStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { APP_CHANNELS } from '../../types/ipc'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { SourceEditor } from './SourceEditor'
import { DiffViewer } from './DiffViewer'
import { StatusBar } from './StatusBar'

export function EditorPane(): JSX.Element {
  const {
    document,
    documents,
    activeDocumentId,
    updateContent,
    updateRawContent,
    enterSourceMode,
    markSaved,
    activateDocument,
    closeDocument
  } = useDocumentStore()
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
    const handleSaveRequest = (): void => {
      void handleSave().then(() => {
        void window.electronAPI.invoke<void>(APP_CHANNELS.CLOSE_ALLOWED)
      })
    }

    window.addEventListener('document:save', handleSaveRequest)
    return () => window.removeEventListener('document:save', handleSaveRequest)
  }, [handleSave])

  useEffect(() => {
    if (editorMode === 'source') {
      enterSourceMode()
    }
  }, [editorMode, enterSourceMode])

  return (
    <div className="flex h-full flex-col" data-editor-pane="true">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto pr-2">
          {documents.map((doc) => {
            const isActive = doc.ref.id === activeDocumentId
            return (
              <button
                key={doc.ref.id}
                onClick={() => activateDocument(doc.ref.id)}
                className={`group flex max-w-[12rem] shrink-0 items-center gap-2 rounded px-2 py-1 text-xs ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                }`}
                title={doc.ref.path}
              >
                <span className="truncate">{doc.ref.name}</span>
                {doc.modified && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    void closeDocument(doc.ref.id)
                  }}
                  className="rounded p-0.5 opacity-0 hover:bg-neutral-200 group-hover:opacity-100 dark:hover:bg-neutral-700"
                  role="button"
                  title="Close tab"
                >
                  <X size={10} />
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded bg-neutral-100 p-0.5 dark:bg-neutral-800">
          <button
            onClick={() => setEditorMode('source')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              editorMode === 'source'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
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
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
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
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
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
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
              title="Diff view"
            >
              <GitCompare size={12} />
              Diff
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden dark:bg-neutral-900 dark:text-white">
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
          <div className="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
            Open a folder and double-click a .md file to edit
          </div>
        )}
      </div>
      <StatusBar document={document} />
    </div>
  )
}
