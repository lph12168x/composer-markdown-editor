import { contextBridge, ipcRenderer } from 'electron'

// Whitelist of allowed IPC channels
const allowedChannels = [
  'fs:readDir',
  'fs:readFile',
  'fs:writeFile',
  'fs:createFile',
  'fs:createDir',
  'fs:rename',
  'fs:delete',
  'fs:stat',
  'dialog:openFolder',
  'dialog:openFile',
  'ssh:connect',
  'ssh:disconnect',
  'ssh:status',
  'git:status',
  'git:init',
  'git:commit',
  'git:stage',
  'git:unstage',
  'git:log',
  'git:diff',
  'git:branches',
  'git:checkout',
  'app:getVersion',
  'settings:get',
  'settings:set',
  'settings:recentDir:add',
  'settings:recentDirs:list',
  'settings:recentDirs:clear',
  'settings:recentConnection:add',
  'settings:recentConnections:list',
  'settings:recentConnection:remove',
  'settings:recentFile:add',
  'settings:recentFiles:list',
  'settings:recentFiles:clear',
  'settings:recentFile:remove',
  'settings:workspace:save',
  'settings:workspace:load',
  'app:modified',
  'app:close-allowed'
] as const

type Channel = (typeof allowedChannels)[number]

export interface ElectronAPI {
  invoke: <T = unknown>(channel: Channel, ...args: unknown[]) => Promise<T>
  onAppPromptClose: (callback: () => void) => () => void
  onFileChanged: (callback: (ref: unknown) => void) => () => void
  onMenuAction: (callback: (action: string, payload?: unknown) => void) => () => void
}

const electronAPI: ElectronAPI = {
  invoke: async (channel, ...args) => {
    if (!allowedChannels.includes(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  onAppPromptClose: (callback) => {
    const handler = (): void => callback()
    ipcRenderer.on('app:prompt-close', handler)
    return () => {
      ipcRenderer.removeListener('app:prompt-close', handler)
    }
  },

  onFileChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, ref: unknown): void => callback(ref)
    ipcRenderer.on('fs:fileChanged', handler)
    return () => {
      ipcRenderer.removeListener('fs:fileChanged', handler)
    }
  },

  onMenuAction: (callback) => {
    const handlers = {
      'menu:open-folder': (): void => callback('open-folder'),
      'menu:open-file': (): void => callback('open-file'),
      'menu:open-recent-folder': (_event: Electron.IpcRendererEvent, payload: unknown): void =>
        callback('open-recent-folder', payload),
      'menu:open-recent-file': (_event: Electron.IpcRendererEvent, payload: unknown): void =>
        callback('open-recent-file', payload),
      'menu:open-recent-ssh': (_event: Electron.IpcRendererEvent, payload: unknown): void =>
        callback('open-recent-ssh', payload)
    }
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcRenderer.on(channel, handler)
    })
    return () => {
      Object.entries(handlers).forEach(([channel, handler]) => {
        ipcRenderer.removeListener(channel, handler)
      })
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
