import { useCallback, useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDocumentStore } from '../stores/fileStore'
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
  const { document: currentDocument, documents, openDocument } = useDocumentStore()
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

    const content = await fileSystemClient.readFile(ref)
    openDocument(ref, content)
  }, [addLocalRoot, openDocument, setActiveRoot])

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
    const handleOpen = async (e: Event) => {
      const ref = (e as CustomEvent).detail as FileRef
      try {
        const content = await fileSystemClient.readFile(ref)
        openDocument(ref, content)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to open file'
        window.alert(message)
        console.error('Failed to open file:', err)
      }
    }

    window.addEventListener('file:open', handleOpen)
    return () => window.removeEventListener('file:open', handleOpen)
  }, [openDocument])

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
        void handleOpenFolder()
      } else if (action === 'open-file') {
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
      } else if (action === 'open-recent-folder' && typeof payload === 'string') {
        handleAddLocalRoot(payload)
      } else if (action === 'open-recent-file' && payload && typeof payload === 'object') {
        const file = payload as FileRef
        void fileSystemClient
          .readFile(file)
          .then((content) => openDocument(file, content))
          .catch((err) => {
            const message = err instanceof Error ? err.message : 'Failed to open file'
            window.alert(message)
            console.error('Failed to open recent file:', err)
          })
      } else if (action === 'open-recent-ssh' && payload && typeof payload === 'object') {
        window.dispatchEvent(new CustomEvent('ssh:menu-reconnect', { detail: payload }))
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

  // Scroll the editor to the heading selected in the outline panel.
  const handleHeadingClick = (heading: Heading): void => {
    const editorPane = document.querySelector('[data-editor-pane="true"]')
    if (!editorPane) return

    const allHeadings = editorPane.querySelectorAll(`h${heading.level}`)
    const target = allHeadings[heading.levelIndex]
    if (!(target instanceof HTMLElement)) return

    const scrollContainer = editorPane.querySelector('[data-editor-scroll="true"]')
    if (!(scrollContainer instanceof HTMLElement)) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const offset = target.offsetTop - scrollContainer.offsetTop - 16
    scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-white">
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
        {activeRoot?.path && <GitPanel root={activeRoot} />}
      </aside>
      <div
        className="group flex w-1 cursor-col-resize items-center justify-center border-r border-neutral-200 bg-neutral-100 hover:bg-blue-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-blue-900/50"
        onMouseDown={startLeftResize}
        title="Drag to resize"
      >
        <div className="h-8 w-0.5 rounded bg-neutral-300 group-hover:bg-blue-400 dark:bg-neutral-600" />
      </div>
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
          <EditorPane />
        )}
      </main>
      {currentDocument && (
        <>
          <div
            className="group flex w-1 cursor-col-resize items-center justify-center border-l border-neutral-200 bg-neutral-100 hover:bg-blue-200 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-blue-900/50"
            onMouseDown={startRightResize}
            title="Drag to resize"
          >
            <div className="h-8 w-0.5 rounded bg-neutral-300 group-hover:bg-blue-400 dark:bg-neutral-600" />
          </div>
          <aside
            className="flex flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            style={{ width: rightWidth, minWidth: 180, maxWidth: 480 }}
          >
            <TocPanel document={currentDocument} onHeadingClick={handleHeadingClick} />
          </aside>
        </>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
