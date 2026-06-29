import { app, BrowserWindow, dialog, Menu } from 'electron'
import { MENU_CHANNELS } from '../types/ipc'
import {
  clearRecentFiles,
  clearRecentLocalDirs,
  listRecentFiles,
  listRecentLocalDirs
} from './settings/settings'

function sendToRenderer(channel: string, payload?: unknown): void {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) return
  window.webContents.send(channel, payload)
}

function buildRecentFoldersSubmenu(): Electron.MenuItemConstructorOptions[] {
  const dirs = listRecentLocalDirs()
  if (dirs.length === 0) {
    return [{ label: 'No recent folders', enabled: false }]
  }

  return [
    ...dirs.map((dir) => ({
      label: dir,
      click: () => {
        sendToRenderer(MENU_CHANNELS.OPEN_RECENT_FOLDER, dir)
      }
    })),
    { type: 'separator' as const },
    {
      label: 'Clear Recent Folders',
      click: () => {
        clearRecentLocalDirs()
        buildAppMenu()
      }
    }
  ]
}

function buildRecentFilesSubmenu(): Electron.MenuItemConstructorOptions[] {
  const files = listRecentFiles()
  if (files.length === 0) {
    return [{ label: 'No recent files', enabled: false }]
  }

  return [
    ...files.map((file) => ({
      label: file.name,
      toolTip: file.path,
      click: () => {
        sendToRenderer(MENU_CHANNELS.OPEN_RECENT_FILE, file)
      }
    })),
    { type: 'separator' as const },
    {
      label: 'Clear Recent Files',
      click: () => {
        clearRecentFiles()
        buildAppMenu()
      }
    }
  ]
}

export function buildAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  template.push({
    label: 'File',
    submenu: [
      {
        label: 'Open Folder',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          sendToRenderer(MENU_CHANNELS.OPEN_FOLDER)
        }
      },
      { type: 'separator' },
      {
        label: 'Recent Folders',
        submenu: buildRecentFoldersSubmenu()
      },
      {
        label: 'Recent Files',
        submenu: buildRecentFilesSubmenu()
      },
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
        click: () => {
          app.quit()
        }
      }
    ]
  })

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  })

  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  })

  template.push({
    label: 'Window',
    submenu: [{ role: 'minimize' }, { role: 'close' }]
  })

  template.push({
    label: 'Help',
    submenu: [
      {
        label: `About ${app.name}`,
        click: async () => {
          const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
          await dialog.showMessageBox(window ?? undefined, {
            type: 'info',
            title: `About ${app.name}`,
            message: app.name,
            detail: `Version ${app.getVersion()}`
          })
        }
      }
    ]
  })

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
