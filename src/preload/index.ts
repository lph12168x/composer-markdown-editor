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
  'app:getVersion'
] as const

type Channel = (typeof allowedChannels)[number]

export interface ElectronAPI {
  invoke: <T = unknown>(channel: Channel, ...args: unknown[]) => Promise<T>
}

const electronAPI: ElectronAPI = {
  invoke: async (channel, ...args) => {
    if (!allowedChannels.includes(channel)) {
      throw new Error(`Unauthorized IPC channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
