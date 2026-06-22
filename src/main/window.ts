import { BrowserWindow, screen } from 'electron'
import path from 'node:path'

export function createMainWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const mainWindow = new BrowserWindow({
    width: Math.min(1400, width * 0.8),
    height: Math.min(900, height * 0.8),
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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
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
