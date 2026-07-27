import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDocumentStore, isImageRef } from '../stores/fileStore'
import { useSshStore } from '../stores/sshStore'
import { useUiStore } from '../stores/uiStore'
import { WorkspacePanel } from '../components/sidebar/WorkspacePanel'
import { FileTree } from '../components/sidebar/FileTree'
import { GitPanel } from '../components/git/GitPanel'
import { EditorPane } from '../components/editor/EditorPane'
import { TocPanel, type Heading } from '../components/editor/TocPanel'
import type { FileRef } from '../types/file'
import { fileSystemClient } from '../services/fileSystemClient'
import { settingsClient } from '../services/settingsClient'
import { APP_CHANNELS } from '../types/ipc'
import { SettingsModal } from '../components/modals/SettingsModal'

function getDirName(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx > 0 ? filePath.slice(0, idx) : filePath
}

function getBaseName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

function isUnderRoot(filePath: string, rootPath: string): boolean {
  const sep = rootPath.endsWith('/') || rootPath.endsWith('\\') ? '' : filePath.includes('\\') ? '\\' : '/'
  return filePath.startsWith(rootPath + sep)
}

function App(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot, loadWorkspace, setActiveRoot } = useWorkspaceStore()
  const { document: currentDocument, documents, openDocument, openImageDocument } = useDocumentStore()
  const handleAddLocalRoot = useCallback(
    (path: string) => {
      addLocalRoot(path)
    },
    [addLocalRoot]
  )
  const activeRoot = workspace.roots.find((r) => r.id === activeRootId)
  const [showSettings, setShowSettings] = useState(false)
  const [recentDirs, setRecentDirs] = useState<string[]>([])
  const [leftWidth, setLeftWidth] = useState(288)
  const [rightWidth, setRightWidth] = useState(224)
  const [gitPanelHeight, setGitPanelHeight] = useState(240)
  const [gitExpanded, setGitExpanded] = useState(true)
  const [leftVisible, setLeftVisible] = useState(true)
  const [rightVisible, setRightVisible] = useState(true)

  const handleOpenFolder = useCallback(async (): Promise<void> => {
    const path = await fileSystemClient.openFolder()
    if (path) {
      addLocalRoot(path)
    }
  }, [addLocalRoot])

  const openLocalFileByPath = useCallback(async (filePath: string): Promise<void> => {
    const roots = useWorkspaceStore.getState().workspace.roots
    const existingRoot = roots.find(
      (r) => r.type === 'local' && r.path && isUnderRoot(filePath, r.path)
    )

    let root = existingRoot
    if (!root) {
      const dir = getDirName(filePath)
      addLocalRoot(dir)
      root = useWorkspaceStore.getState().workspace.roots.find(
        (r) => r.type === 'local' && r.path === dir
      )
    }

    if (root) {
      setActiveRoot(root.id)
    }

    const ref: FileRef = {
      id: `local:${filePath}`,
      rootId: root?.id || 'drop',
      type: 'local',
      path: filePath,
      name: getBaseName(filePath),
      isDirectory: false
    }

    if (isImageRef(ref)) {
      const dataUrl = await fileSystemClient.readFileAsDataUrl(ref)
      openImageDocument(ref, dataUrl)
    } else {
      const content = await fileSystemClient.readFile(ref)
      openDocument(ref, content)
    }
  }, [addLocalRoot, openDocument, openImageDocument, setActiveRoot])

  const startLeftResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = leftWidth
    const minWidth = 180
    const maxWidth = 480

    const onMove = (ev: MouseEvent): void => {
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + ev.clientX - startX))
      setLeftWidth(newWidth)
    }

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftWidth])

  const startRightResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = rightWidth
    const minWidth = 180
    const maxWidth = 480

    const onMove = (ev: MouseEvent): void => {
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - (ev.clientX - startX)))
      setRightWidth(newWidth)
    }

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightWidth])

  const startGitResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = gitPanelHeight
    const minHeight = 120
    const maxHeight = 480

    const onMove = (ev: MouseEvent): void => {
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - (ev.clientY - startY)))
      setGitPanelHeight(newHeight)
    }

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [gitPanelHeight])

  // Load persisted theme, workspace, and window state on startup.
  useEffect(() => {
    let cancelled = false

    const init = async (): Promise<void> => {
      try {
        const [theme, savedWorkspace, dirs] = await Promise.all([
          settingsClient.getTheme(),
          settingsClient.loadWorkspace(),
          settingsClient.listRecentDirs()
        ])
        if (cancelled) return

        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }

        setRecentDirs(dirs)

        if (savedWorkspace.length > 0) {
          loadWorkspace({ id: `${Date.now()}`, name: 'Untitled Workspace', roots: savedWorkspace })
        }
      } catch (err) {
        console.error('Failed to initialize settings:', err)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [loadWorkspace])

  // Open files dispatched from the file tree.
  useEffect(() => {
    const handleOpen = async (e: Event): Promise<void> => {
      const ref = (e as CustomEvent).detail as FileRef
      try {
        if (isImageRef(ref)) {
          const dataUrl = await fileSystemClient.readFileAsDataUrl(ref)
          openImageDocument(ref, dataUrl)
        } else {
          const content = await fileSystemClient.readFile(ref)
          openDocument(ref, content)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open file'
        window.alert(message)
        console.error('Failed to open file:', err)
      }
    }

    window.addEventListener('file:open', handleOpen)
    return () => window.removeEventListener('file:open', handleOpen)
  }, [openDocument, openImageDocument])

  // Keyboard shortcuts: open folder, save (in EditorPane), settings.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFolder()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleOpenFolder])

  // Drag-and-drop files from the OS file manager to open them.
  useEffect(() => {
    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault()
    }

    const handleDrop = async (e: DragEvent): Promise<void> => {
      e.preventDefault()
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      for (const file of files) {
        const filePath = (file as unknown as { path?: string }).path
        if (!filePath) continue

        try {
          await openLocalFileByPath(filePath)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to open dropped file'
          window.alert(message)
          console.error('Failed to open dropped file:', err)
        }
      }
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [openLocalFileByPath])

  // Native File menu actions.
  useEffect(() => {
    return window.electronAPI.onMenuAction((action, payload) => {
      if (action === 'open-folder') {
        const { isConnected } = useSshStore.getState()
        if (isConnected) {
          window.dispatchEvent(new CustomEvent('ssh:open-folder'))
        } else {
          void handleOpenFolder()
        }
      } else if (action === 'open-file') {
        const { isConnected } = useSshStore.getState()
        if (isConnected) {
          window.dispatchEvent(new CustomEvent('ssh:open-file'))
        } else {
          void (async () => {
            const filePath = await fileSystemClient.openFile()
            if (filePath) {
              try {
                await openLocalFileByPath(filePath)
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to open file'
                window.alert(message)
                console.error('Failed to open file:', err)
              }
            }
          })()
        }
      } else if (action === 'open-recent-folder' && typeof payload === 'string') {
        handleAddLocalRoot(payload)
      } else if (action === 'open-recent-file' && payload && typeof payload === 'object') {
        const file = payload as FileRef
        // Recent files can be either text or images; dispatch through the
        // same CustomEvent path the file tree uses so we don't duplicate
        // the kind-detection logic.
        window.dispatchEvent(new CustomEvent('file:open', { detail: file }))
      } else if (action === 'open-recent-ssh' && payload && typeof payload === 'object') {
        window.dispatchEvent(new CustomEvent('ssh:menu-reconnect', { detail: payload }))
      } else if (action === 'toggle-left-panel') {
        setLeftVisible((v) => !v)
      } else if (action === 'toggle-right-panel') {
        setRightVisible((v) => !v)
      }
    })
  }, [handleAddLocalRoot, handleOpenFolder, openDocument, openLocalFileByPath])

  // Close-before-save prompt.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onAppPromptClose(() => {
      const hasUnsaved = documents.some((doc) => doc.modified)
      if (!hasUnsaved) {
        void window.electronAPI.invoke<void>(APP_CHANNELS.CLOSE_ALLOWED)
        return
      }

      const shouldSave = window.confirm('You have unsaved changes. Save before closing?')
      if (shouldSave) {
        window.dispatchEvent(new CustomEvent('document:save'))
      } else {
        void window.electronAPI.invoke<void>(APP_CHANNELS.CLOSE_ALLOWED)
      }
    })

    return unsubscribe
  }, [documents])

  // External file change detection.
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFileChanged((ref) => {
      if (!currentDocument) return
      const changedRef = ref as FileRef
      if (changedRef.id !== currentDocument.ref.id) return

      const shouldReload = window.confirm(
        `The file "${changedRef.name}" has changed externally. Reload it?`
      )
      if (!shouldReload) return

      fileSystemClient
        .readFile(changedRef)
        .then((content) => {
          openDocument(changedRef, content)
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to reload file'
          window.alert(message)
          console.error('Failed to reload file:', err)
        })
    })

    return unsubscribe
  }, [currentDocument, openDocument])

  // Outline synchronization: track the heading currently visible at the top
    // of the editor scroller and pass it to <TocPanel> for highlighting.
    const editorMode = useUiStore((s) => s.editorMode)
    const [activeHeading, setActiveHeading] = useState<Heading | null>(null)
    // While the outline itself programmatically scrolls the body, the
    // IntersectionObserver will momentarily disagree with the clicked target.
    // This ref locks `activeHeading` for a short window so the highlight does
    // not flicker during that settle period.
    const scrollLockUntilRef = useRef<number>(0)

    // Scroll the editor to the heading selected in the outline panel.
      const handleHeadingClick = (heading: Heading): void => {
        const editorPane = document.querySelector('[data-editor-pane="true"]')
        if (!editorPane) return

        const scrollContainer = editorPane.querySelector('[data-editor-scroll="true"]')
        if (!(scrollContainer instanceof HTMLElement)) return

        // Source mode renders headings only as plain `.cm-line` text — there is
        // no semantic `<hN>` DOM node for the legacy DOM lookup to find. App
        // dispatches a CustomEvent that SourceEditor listens for; it translates
        // the 0-indexed `heading.line` into a CodeMirror position and scrolls.
        const isSourceMode = editorMode === 'source'
        if (isSourceMode) {
          scrollContainer.dispatchEvent(
            new CustomEvent('editor:scroll-to-line', { detail: { line: heading.line } })
          )
          setActiveHeading(heading)
          scrollLockUntilRef.current = Date.now() + 320
          return
        }

        const allHeadings = editorPane.querySelectorAll(`h${heading.level}`)
        const target = allHeadings[heading.levelIndex]
        if (!(target instanceof HTMLElement)) {
          // Heading not yet in DOM (e.g. preview still re-rendering). Fall back
          // to the native scrollIntoView so the click still does *something*.
          void editorPane.querySelector('[data-editor-scroll="true"]')?.scrollTo({ top: 0 })
          setActiveHeading(heading)
          scrollLockUntilRef.current = Date.now() + 320
          return
        }

        const offset = target.offsetTop - scrollContainer.offsetTop - 16
        scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'auto' })
        setActiveHeading(heading)
        scrollLockUntilRef.current = Date.now() + 320
      }

    /**
     * Receive a heading picked by an editor (currently only `SourceEditor`,
     * which does not render semantic `<hN>` elements and so cannot be observed
     * via IntersectionObserver).
     *
     * Guarded by `scrollLockUntilRef` so the outline click that triggered the
     * scroll does not get clobbered by the editor's own scroll-driven report.
     */
    const handleEditorActiveHeadingChange = useCallback((heading: Heading | null): void => {
      if (Date.now() < scrollLockUntilRef.current) return
      setActiveHeading(heading)
    }, [])

    // Watch the editor scroll container and keep `activeHeading` in sync.
    //
    // DOM-based observation only works for `edit` and `preview` modes, where
    // the editor renders semantic `<hN>` elements inside the scroll container.
    // In `source` mode the editor is a CodeMirror instance that renders flat
    // `.cm-line` nodes only; <SourceEditor> drives `activeHeading` itself via
    // the `onActiveHeadingChange` prop. In `diff` mode there is no document
    // body to scroll, so we leave the highlight cleared.
    //
    // Effect fires only when the document or view mode changes; observers are
    // torn down and rebuilt on each cycle so we never leak listeners onto a
    // detached DOM (Crepe mounts asynchronously).
    useEffect(() => {
      if (editorMode !== 'edit' && editorMode !== 'preview') {
        // `source` mode: SourceEditor reports headings to us via callback.
        // `diff` mode: nothing to highlight.
        return
      }

      let io: IntersectionObserver | null = null
      let mo: MutationObserver | null = null
      let initTimer: ReturnType<typeof setTimeout> | null = null
      let raf: number | null = null
      let scrollContainer: HTMLElement | null = null
      let scrollListener: (() => void) | null = null

      const pickActive = (): void => {
        if (!scrollContainer) return
        // Skip while a click-driven scroll is settling.
        if (Date.now() < scrollLockUntilRef.current) return

        const containerRect = scrollContainer.getBoundingClientRect()
        const viewportH = scrollContainer.clientHeight
        // Active band: the top 40% of the visible scroll area. A heading
        // becomes active as soon as its top edge scrolls up past the 40% line;
        // this matches the "section the user is currently reading" UX used by
        // Notion / Typora / VSCode Outline.
        const activeLimit = containerRect.top + viewportH * 0.4

        let best: { heading: Heading; top: number } | null = null

        for (let level = 1; level <= 6; level += 1) {
          const nodes = scrollContainer.querySelectorAll(`h${level}`)
          // for...of (not forEach) so TS keeps `best` typed as the declared
          // union across iterations — forEach callback narrows reassigned
          // `let`s down to `never` on the second assignment.
          for (const [idx, node] of Array.from(nodes).entries()) {
            if (!(node instanceof HTMLElement)) continue
            const top = node.getBoundingClientRect().top
            if (top <= activeLimit && (best === null || top > best.top)) {
              best = {
                heading: { level, levelIndex: idx, line: 0, text: node.textContent ?? '' },
                top
              }
            }
          }
        }

        setActiveHeading(best ? best.heading : null)
      }

      const attachToContainer = (next: HTMLElement): void => {
        // Tear down anything we previously attached to an old container.
        io?.disconnect()
        mo?.disconnect()
        if (scrollContainer && scrollListener) {
          scrollContainer.removeEventListener('scroll', scrollListener)
        }

        scrollContainer = next

        // We don't actually use the IO callback anymore — the scroll listener
        // and MutationObserver already cover all the events we need (scroll,
        // DOM mutation) and `pickActive` is fully deterministic from layout.
        // But we still want to observe so the browser batches Intersection
        // notifications efficiently. Keeping the observer is cheap and gives
        // us a redundant trigger when headings enter/leave the viewport.
        io = new IntersectionObserver(pickActive, {
          root: scrollContainer,
          rootMargin: '0px 0px -60% 0px',
          threshold: [0, 1]
        })

        const observeHeadings = (): void => {
          if (!scrollContainer || !io) return
          for (let level = 1; level <= 6; level += 1) {
            scrollContainer.querySelectorAll(`h${level}`).forEach((node) => {
              if (node instanceof HTMLElement) io!.observe(node)
            })
          }
        }

        observeHeadings()
        // Crepe renders headings asynchronously after `create()`. Watching the
        // subtree lets us pick up newly created `<hN>` elements and recompute
        // the active heading whenever the DOM mutates underneath us.
        mo = new MutationObserver(() => {
          observeHeadings()
          pickActive()
        })
        mo.observe(scrollContainer, { childList: true, subtree: true })

        // Belt-and-suspenders: also re-evaluate on every scroll tick. Long
        // bodies and elastic scroll can move the top heading without any IO
        // entry change, and we want the highlight to keep following.
        scrollListener = (): void => pickActive()
        scrollContainer.addEventListener('scroll', scrollListener, { passive: true })

        pickActive()
      }

      const tryAttach = (): void => {
        const editorPane = document.querySelector('[data-editor-pane="true"]')
        const next = editorPane?.querySelector('[data-editor-scroll="true"]')
        if (!(next instanceof HTMLElement)) return
        if (next === scrollContainer) return
        attachToContainer(next)
      }

      // Crepe mounts asynchronously; the container may not exist on the first
      // synchronous pass. Try once now, once after a short delay, and once
      // again on the next frame as a last-chance catch.
      tryAttach()
      initTimer = setTimeout(tryAttach, 150)
      raf = requestAnimationFrame(tryAttach)

      return () => {
        if (initTimer) clearTimeout(initTimer)
        if (raf !== null) cancelAnimationFrame(raf)
        io?.disconnect()
        mo?.disconnect()
        if (scrollContainer && scrollListener) {
          scrollContainer.removeEventListener('scroll', scrollListener)
        }
        scrollContainer = null
        scrollListener = null
      }
    }, [editorMode, currentDocument?.ref.id])

  return (
    <div className="flex h-screen w-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-white">
      {leftVisible && (
        <>
          <aside
            className="flex flex-col border-r border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            style={{ width: leftWidth, minWidth: 180, maxWidth: 480 }}
          >
            <WorkspacePanel />
            <div className="flex-1 overflow-auto">
              {activeRoot && (
                <FileTree
                  root={activeRoot}
                  rootRef={{
                    id: activeRoot.id,
                    rootId: activeRoot.id,
                    type: activeRoot.type,
                    path: activeRoot.path || '',
                    name: activeRoot.name,
                    isDirectory: true
                  }}
                />
              )}
            </div>
            {activeRoot?.path && (
              <>
                <div
                  className="group flex h-1 cursor-row-resize items-center justify-center bg-neutral-100 hover:bg-blue-200 dark:bg-neutral-800 dark:hover:bg-blue-900/50"
                  onMouseDown={startGitResize}
                  title="Drag to resize"
                >
                  <div className="h-0.5 w-8 rounded bg-neutral-300 group-hover:bg-blue-400 dark:bg-neutral-600" />
                </div>
                <div
                  className="overflow-hidden"
                  style={{
                    height: gitExpanded ? gitPanelHeight : 'auto',
                    minHeight: gitExpanded ? 120 : 'auto',
                    maxHeight: gitExpanded ? 480 : 'auto'
                  }}
                >
                  <GitPanel root={activeRoot} expanded={gitExpanded} onExpandedChange={setGitExpanded} />
                </div>
              </>
            )}
          </aside>
          <div
            className="group flex w-1 cursor-col-resize items-center justify-center border-r border-neutral-200 bg-neutral-100 hover:bg-blue-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-blue-900/50"
            onMouseDown={startLeftResize}
            onDoubleClick={() => setLeftVisible((v) => !v)}
            title="Drag to resize, double-click to hide"
          >
            <div className="h-8 w-0.5 rounded bg-neutral-300 group-hover:bg-blue-400 dark:bg-neutral-600" />
          </div>
        </>
      )}
      <main className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-900">
        {!activeRoot ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-neutral-500 dark:text-neutral-400">
            <FolderOpen size={48} />
            <p className="text-lg text-neutral-700 dark:text-neutral-200">No folder opened</p>
            <p className="text-sm">Open a folder to browse files and edit Markdown</p>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <FolderOpen size={18} />
              Open Folder
            </button>
            {recentDirs.length > 0 && (
              <div className="flex w-full max-w-md flex-col items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  Open Recent Folder
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentDirs.map((dir) => (
                    <button
                      key={dir}
                      onClick={() => addLocalRoot(dir)}
                      className="max-w-xs truncate rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      title={dir}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-neutral-500 dark:text-neutral-500">or press Ctrl+O</p>
          </div>
        ) : (
          <EditorPane onActiveHeadingChange={handleEditorActiveHeadingChange} />
        )}
      </main>
      {currentDocument && rightVisible && (
        <>
          <div
            className="group flex w-1 cursor-col-resize items-center justify-center border-l border-neutral-200 bg-neutral-100 hover:bg-blue-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-blue-900/50"
            onMouseDown={startRightResize}
            onDoubleClick={() => setRightVisible((v) => !v)}
            title="Drag to resize, double-click to hide"
          >
            <div className="h-8 w-0.5 rounded bg-neutral-300 group-hover:bg-blue-400 dark:bg-neutral-600" />
          </div>
          <aside
            className="flex flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            style={{ width: rightWidth, minWidth: 180, maxWidth: 480 }}
          >
            <TocPanel
              document={currentDocument}
              onHeadingClick={handleHeadingClick}
              activeHeading={activeHeading}
            />
          </aside>
        </>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
