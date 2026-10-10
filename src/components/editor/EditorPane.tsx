import { useEffect, useCallback, useRef, useState } from 'react'
import { Eye, FileCode, Pencil, GitCompare, X } from 'lucide-react'
import { useDocumentStore } from '../../stores/fileStore'
import { useUiStore } from '../../stores/uiStore'
import { fileSystemClient } from '../../services/fileSystemClient'
import { APP_CHANNELS } from '../../types/ipc'
import { recallScroll, rememberScroll, scrollMemoryKey } from '../../utils/scrollMemory'
import { MarkdownEditor } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { SourceEditor } from './SourceEditor'
import { ImageViewer } from './ImageViewer'
import { DiffViewer } from './DiffViewer'
import { StatusBar } from './StatusBar'
import { FindBar, type FindController } from './FindBar'
import type { Heading } from './TocPanel'

export interface EditorPaneProps {
  /**
   * Called by editors that drive the outline highlight themselves (currently
   * only `SourceEditor`; `MarkdownEditor` / `MarkdownPreview` observe the DOM
   * directly via the App-level IntersectionObserver).
   *
   * Caller is responsible for any click-driven lock so the outline click
   * that scrolled the body is not clobbered by the editor's own report.
   */
  onActiveHeadingChange?: (heading: Heading | null) => void
}

export function EditorPane({ onActiveHeadingChange }: EditorPaneProps = {}): JSX.Element {
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
  const paneRef = useRef<HTMLDivElement>(null)

  // Find-bar state. The bar is opened by Cmd/Ctrl+F and is only meaningful
  // for text documents (markdown / source); image tabs hide it.
  const [findOpen, setFindOpen] = useState(false)
  // Each editor publishes a FindController through this ref. The FindBar
  // reads the latest one through `getController()`.
  const findControllerRef = useRef<FindController | null>(null)
  const registerFindController = useCallback((c: FindController | null) => {
    findControllerRef.current = c
  }, [])
  // Close the find bar when the user switches tabs/modes. Done in the
  // click handlers rather than a useEffect so we don't call setState
  // synchronously inside an effect (which cascades renders).
  // We intentionally do NOT null out findControllerRef here: React runs
  // parent effects AFTER child mount effects, so nulling here would
  // clobber the controller the just-mounted editor already published.
  // The old editor's cleanup effect replaces the ref with NOOP_CONTROLLER,
  // and the new editor's mount effect sets it to the real controller.
  const handleActivateDocument = useCallback(
    (id: string) => {
      setFindOpen(false)
      activateDocument(id)
    },
    [activateDocument]
  )

  const handleSetEditorMode = useCallback(
    (mode: typeof editorMode) => {
      setFindOpen(false)
      setEditorMode(mode)
    },
    [setEditorMode]
  )

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
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Cmd/Ctrl+F opens the in-editor find bar. Skip when the user is
      // editing inside the find input itself or any other text input —
      // those should keep the browser's default Cmd+F behaviour (open
      // DevTools search, etc.). For now we always intercept because the
      // bar is the only in-app search affordance.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (document && document.kind !== 'image') {
          e.preventDefault()
          setFindOpen(true)
        }
      }
      // Esc closes the find bar even when the input doesn't have focus
      // (e.g. user has clicked into the editor body).
      if (e.key === 'Escape' && findOpen) {
        e.preventDefault()
        setFindOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, document, findOpen])

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
    // Image documents have no markdown source to switch into.
    if (editorMode === 'source' && document?.kind !== 'image') {
      enterSourceMode()
    }
  }, [editorMode, enterSourceMode, document?.kind])

  /**
   * Per-document reading position.
   *
   * Each editor owns its scroll container, and the keyed ones (WYSIWYG /
   * source) remount on every tab switch, so the element is re-resolved from
   * the DOM on each attempt rather than captured once. Saving goes through a
   * capture listener on the pane root because scroll events don't bubble and
   * CodeMirror can rebuild its scroller: a detached element would otherwise
   * keep firing events nobody sees.
   */
  const docId = document?.ref.id ?? null
  const docRevision = document?.revision ?? 0
  useEffect(() => {
    const pane = paneRef.current
    if (!pane || !docId || editorMode === 'diff') return

    const key = scrollMemoryKey(docId, editorMode)
    let settled = false
    let scrolled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const handleScroll = (event: Event): void => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.closest('[data-editor-scroll="true"]')) return
      scrolled = true
      rememberScroll(key, target.scrollTop)
    }
    pane.addEventListener('scroll', handleScroll, true)

    const restore = (): void => {
      // Stop as soon as anything scrolls: our own assignment produces the
      // event, so this also ends the retry loop once the offset has landed.
      if (settled || scrolled) return
      const holder = pane.querySelector<HTMLElement>('[data-editor-scroll="true"]')
      if (!holder) return
      const cmScroller = holder.querySelector<HTMLElement>('.cm-scroller')
      // CodeMirror builds its own scroller a frame later; setting the offset on
      // the wrapper would just be ignored.
      if (holder.classList.contains('source-editor') && !cmScroller) return
      const scroller = cmScroller ?? holder

      const target = recallScroll(key)
      const max = scroller.scrollHeight - scroller.clientHeight
      // Crepe fills its container asynchronously, so an offset that is not
      // reachable yet means the content is not laid out — try again later.
      if (target > 0 && max === 0) return
      const applied = Math.min(target, max)
      if (scroller.scrollTop === applied) {
        settled = true
        return
      }
      // Always assigned, including the zero case: the preview container is
      // reused across tabs and would otherwise keep the previous position.
      scroller.scrollTop = applied
    }

    restore()
    // 30ms covers ProseMirror's first paint; 300ms covers a slow Mermaid swap.
    ;[30, 120, 300].forEach((delay) => timers.push(setTimeout(restore, delay)))

    return () => {
      pane.removeEventListener('scroll', handleScroll, true)
      timers.forEach(clearTimeout)
    }
  }, [docId, docRevision, editorMode])

  return (
    <div ref={paneRef} className="flex h-full flex-col" data-editor-pane="true">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto pr-2">
          {documents.map((doc) => {
            const isActive = doc.ref.id === activeDocumentId
            return (
              <button
                key={doc.ref.id}
                onClick={() => handleActivateDocument(doc.ref.id)}
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
          {document?.kind !== 'image' && (
            <>
              <button
                onClick={() => handleSetEditorMode('source')}
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
                onClick={() => handleSetEditorMode('preview')}
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
                onClick={() => handleSetEditorMode('edit')}
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
                  onClick={() => handleSetEditorMode('diff')}
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
            </>
          )}
        </div>
      </div>
      <FindBar
        getController={() => findControllerRef.current}
        open={findOpen && document?.kind !== 'image'}
        onClose={() => setFindOpen(false)}
      />
      <div className="flex-1 overflow-hidden dark:bg-neutral-900 dark:text-white">
        {editorMode === 'diff' && document?.kind !== 'image' ? (
          <DiffViewer />
        ) : document?.kind === 'image' ? (
          <ImageViewer document={document} />
        ) : document ? (
          editorMode === 'edit' ? (
            <MarkdownEditor
              key={`${document.ref.id}:${document.revision}`}
              content={document.content}
              onChange={updateContent}
              onFindController={registerFindController}
            />
          ) : editorMode === 'preview' ? (
            <MarkdownPreview
              content={document.content}
              baseRef={document.ref}
              onFindController={registerFindController}
            />
          ) : (
            <SourceEditor
              key={`${document.ref.id}:${document.revision}`}
              content={document.rawContent}
              onChange={updateRawContent}
              onActiveHeadingChange={onActiveHeadingChange}
              onFindController={registerFindController}
            />
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
