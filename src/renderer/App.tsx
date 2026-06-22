import { useCallback, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDocumentStore } from '../stores/fileStore'
import { WorkspacePanel } from '../components/sidebar/WorkspacePanel'
import { FileTree } from '../components/sidebar/FileTree'
import { EditorPane } from '../components/editor/EditorPane'
import { TocPanel, type Heading } from '../components/editor/TocPanel'
import type { FileRef } from '../types/file'
import { fileSystemClient } from '../services/fileSystemClient'

function App(): JSX.Element {
  const { workspace, activeRootId, addLocalRoot } = useWorkspaceStore()
  const { document: currentDocument, openDocument } = useDocumentStore()
  const activeRoot = workspace.roots.find((r) => r.id === activeRootId)

  const handleOpenFolder = useCallback(async (): Promise<void> => {
    const path = await fileSystemClient.openFolder()
    if (path) {
      addLocalRoot(path)
    }
  }, [addLocalRoot])

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpenFolder()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleOpenFolder])

  // Scroll the editor to the heading selected in the outline panel.
  // This assumes the editor renders standard semantic <h1>...<h6> elements
  // and marks its scrollable container with data-editor-scroll="true".
  const handleHeadingClick = (heading: Heading): void => {
    const editorPane = document.querySelector('[data-editor-pane="true"]')
    if (!editorPane) return

    const allHeadings = editorPane.querySelectorAll(`h${heading.level}`)
    const target = allHeadings[heading.levelIndex]
    if (!(target instanceof HTMLElement)) return

    const scrollContainer = editorPane.querySelector('[data-editor-scroll="true"]')
    if (!(scrollContainer instanceof HTMLElement)) {
      // Fallback: let the browser handle scrolling
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const offset = target.offsetTop - scrollContainer.offsetTop - 16
    scrollContainer.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-50 text-neutral-900">
      <aside className="flex w-72 min-w-72 flex-col border-r border-neutral-200 bg-white">
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
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden bg-white">
        {!activeRoot ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-neutral-500">
            <FolderOpen size={48} />
            <p className="text-lg text-neutral-700">No folder opened</p>
            <p className="text-sm">Open a folder to browse files and edit Markdown</p>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <FolderOpen size={18} />
              Open Folder
            </button>
            <p className="text-xs text-neutral-500">or press Ctrl+O</p>
          </div>
        ) : (
          <EditorPane />
        )}
      </main>
      {currentDocument && (
        <aside className="flex w-56 min-w-56 flex-col border-l border-neutral-200 bg-white">
          <TocPanel document={currentDocument} onHeadingClick={handleHeadingClick} />
        </aside>
      )}
    </div>
  )
}

export default App
