import { BrowserWindow, screen, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { APP_CHANNELS } from '../types/ipc'
import type { FileRef } from '../types/file'
import { getWindowState, setWindowState } from './settings/settings'

let mainWindow: BrowserWindow | null = null
let documentModified = false
let allowClose = false
let fileWatcher: fs.FSWatcher | null = null
let watchedFileRef: FileRef | null = null
let isWritingFile = false

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function createMainWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const savedState = getWindowState()

  const defaultWidth = Math.min(1400, screenWidth * 0.8)
  const defaultHeight = Math.min(900, screenHeight * 0.8)

  const width = savedState.width > 0 ? Math.min(savedState.width, screenWidth) : defaultWidth
  const height = savedState.height > 0 ? Math.min(savedState.height, screenHeight) : defaultHeight

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      // Security baseline
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webSecurity: true
    }
  })

  if (savedState.maximized) {
    mainWindow.maximize()
  }

  // CSP for dev and production
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob:; " +
            "font-src 'self'; " +
            "connect-src 'self';"
        ]
      }
    })
  })

  const showWindow = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  }

  mainWindow.once('ready-to-show', showWindow)

  // Fallback: on some Linux/Wayland setups ready-to-show never fires, leaving the window hidden.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      showWindow()
    }
  }, 1500)

  const saveWindowState = (): void => {
    if (!mainWindow) return
    const isMaximized = mainWindow.isMaximized()
    const bounds = mainWindow.getNormalBounds()
    setWindowState({
      width: bounds.width,
      height: bounds.height,
      maximized: isMaximized
    })
  }

  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)

  mainWindow.on('close', (event) => {
    if (allowClose) {
      return
    }
    if (documentModified && mainWindow) {
      event.preventDefault()
      mainWindow.webContents.send(APP_CHANNELS.PROMPT_CLOSE)
    }
  })

  mainWindow.on('closed', () => {
    stopWatchingFile()
    mainWindow = null
  })

  // Track whether the current document has unsaved changes.
  ipcMain.on(APP_CHANNELS.MODIFIED, (_, modified: boolean) => {
    documentModified = modified
  })

  // Allow the renderer to close the window after handling the prompt.
  ipcMain.on(APP_CHANNELS.CLOSE_ALLOWED, () => {
    allowClose = true
    mainWindow?.close()
  })

  // Forward renderer console messages to main process terminal
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = `[renderer:${level}]`
    console.log(prefix, message, `(${sourceId}:${line})`)
  })

  // HMR for renderer based on electron-vite
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function setDocumentModified(modified: boolean): void {
  documentModified = modified
}

export function watchFile(ref: FileRef): void {
  stopWatchingFile()
  if (ref.type !== 'local') return

  watchedFileRef = ref
  try {
    fileWatcher = fs.watch(watchedFileRef.path, (_eventType) => {
      if (isWritingFile) return
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (!watchedFileRef) return
      mainWindow.webContents.send(APP_CHANNELS.FILE_CHANGED, watchedFileRef)
    })
  } catch (err) {
    console.error('Failed to watch file:', err)
  }
}

export function stopWatchingFile(): void {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
  watchedFileRef = null
}

export function pauseFileWatcher(): void {
  isWritingFile = true
}

export function resumeFileWatcher(): void {
  // Delay resuming slightly to avoid catching the write event tail.
  setTimeout(() => {
    isWritingFile = false
  }, 100)
}
