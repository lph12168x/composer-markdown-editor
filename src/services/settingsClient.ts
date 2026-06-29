import type { WorkspaceRoot } from '../types/file'
import {
  SETTINGS_CHANNELS,
  type RecentFile,
  type RecentSshConnection,
  type SettingsSchema,
  type ThemeSetting,
  type WindowState
} from '../types/ipc'

class SettingsClient {
  async get<K extends keyof SettingsSchema>(key: K): Promise<SettingsSchema[K]> {
    return window.electronAPI.invoke<SettingsSchema[K]>(SETTINGS_CHANNELS.GET, key)
  }

  async set<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.SET, key, value)
  }

  async addRecentDir(path: string): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_DIR_ADD, path)
  }

  async listRecentDirs(): Promise<string[]> {
    return window.electronAPI.invoke<string[]>(SETTINGS_CHANNELS.RECENT_DIRS_LIST)
  }

  async clearRecentDirs(): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_DIRS_CLEAR)
  }

  async addRecentConnection(connection: RecentSshConnection): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_CONNECTION_ADD, connection)
  }

  async listRecentConnections(): Promise<RecentSshConnection[]> {
    return window.electronAPI.invoke<RecentSshConnection[]>(SETTINGS_CHANNELS.RECENT_CONNECTIONS_LIST)
  }

  async removeRecentConnection(host: string, username: string): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_CONNECTION_REMOVE, host, username)
  }

  async addRecentFile(file: RecentFile): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_FILE_ADD, file)
  }

  async listRecentFiles(): Promise<RecentFile[]> {
    return window.electronAPI.invoke<RecentFile[]>(SETTINGS_CHANNELS.RECENT_FILES_LIST)
  }

  async clearRecentFiles(): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_FILES_CLEAR)
  }

  async removeRecentFile(id: string): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.RECENT_FILE_REMOVE, id)
  }

  async saveWorkspace(roots: WorkspaceRoot[]): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.WORKSPACE_SAVE, roots)
  }

  async loadWorkspace(): Promise<WorkspaceRoot[]> {
    return window.electronAPI.invoke<WorkspaceRoot[]>(SETTINGS_CHANNELS.WORKSPACE_LOAD)
  }

  async getTheme(): Promise<ThemeSetting> {
    return window.electronAPI.invoke<ThemeSetting>(SETTINGS_CHANNELS.GET, 'theme')
  }

  async setTheme(theme: ThemeSetting): Promise<void> {
    return window.electronAPI.invoke<void>(SETTINGS_CHANNELS.SET, 'theme', theme)
  }

  async getWindowState(): Promise<WindowState> {
    return window.electronAPI.invoke<WindowState>(SETTINGS_CHANNELS.GET, 'windowState')
  }
}

export const settingsClient = new SettingsClient()
