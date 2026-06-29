import { ipcMain } from 'electron'
import type { RecentFile, RecentSshConnection, SettingsSchema } from '../../types/ipc'
import { SETTINGS_CHANNELS } from '../../types/ipc'
import type { WorkspaceRoot } from '../../types/file'
import {
  addRecentConnection,
  addRecentFile,
  addRecentLocalDir,
  clearRecentFiles,
  clearRecentLocalDirs,
  getSetting,
  listRecentConnections,
  listRecentFiles,
  listRecentLocalDirs,
  loadWorkspace,
  removeRecentConnection,
  removeRecentFile,
  saveWorkspace,
  setSetting
} from '../settings/settings'
import { buildAppMenu } from '../menu'

export function registerSettingsIPC(): void {
  ipcMain.handle(
    SETTINGS_CHANNELS.GET,
    <K extends keyof SettingsSchema>(_: Electron.IpcMainInvokeEvent, key: K): SettingsSchema[K] => {
      return getSetting(key)
    }
  )

  ipcMain.handle(
    SETTINGS_CHANNELS.SET,
    <K extends keyof SettingsSchema>(
      _: Electron.IpcMainInvokeEvent,
      key: K,
      value: SettingsSchema[K]
    ): void => {
      setSetting(key, value)
    }
  )

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_DIR_ADD, (_, path: string): void => {
    addRecentLocalDir(path)
    buildAppMenu()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_DIRS_LIST, (): string[] => {
    return listRecentLocalDirs()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_DIRS_CLEAR, (): void => {
    clearRecentLocalDirs()
    buildAppMenu()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_CONNECTION_ADD, (_, connection: RecentSshConnection): void => {
    addRecentConnection(connection)
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_CONNECTIONS_LIST, (): RecentSshConnection[] => {
    return listRecentConnections()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_CONNECTION_REMOVE, (_, host: string, username: string): void => {
    removeRecentConnection(host, username)
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_FILE_ADD, (_, file: RecentFile): void => {
    addRecentFile(file)
    buildAppMenu()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_FILES_LIST, (): RecentFile[] => {
    return listRecentFiles()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_FILES_CLEAR, (): void => {
    clearRecentFiles()
    buildAppMenu()
  })

  ipcMain.handle(SETTINGS_CHANNELS.RECENT_FILE_REMOVE, (_, id: string): void => {
    removeRecentFile(id)
    buildAppMenu()
  })

  ipcMain.handle(SETTINGS_CHANNELS.WORKSPACE_SAVE, (_, roots: WorkspaceRoot[]): void => {
    saveWorkspace(roots)
  })

  ipcMain.handle(SETTINGS_CHANNELS.WORKSPACE_LOAD, (): WorkspaceRoot[] => {
    return loadWorkspace()
  })
}
