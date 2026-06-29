import StoreCtor from 'electron-store'
import type Store from 'electron-store'
import type { WorkspaceRoot } from '../../types/file'
import type {
  RecentFile,
  RecentSshConnection,
  SettingsSchema,
  ThemeSetting,
  WindowState
} from '../../types/ipc'

const ElectronStore =
  (StoreCtor as unknown as { default?: typeof Store }).default ?? (StoreCtor as unknown as typeof Store)

const store = new ElectronStore<SettingsSchema>({
  name: 'composer-markdown-editor-settings',
  defaults: {
    recentLocalDirs: [],
    recentSshConnections: [],
    recentFiles: [],
    windowState: { width: 0, height: 0 },
    theme: 'light'
  }
})

export function getSetting<K extends keyof SettingsSchema>(key: K): SettingsSchema[K] {
  return store.get(key)
}

export function setSetting<K extends keyof SettingsSchema>(key: K, value: SettingsSchema[K]): void {
  store.set(key, value)
}

export function addRecentLocalDir(path: string): void {
  const dirs = store.get('recentLocalDirs').filter((p) => p !== path)
  dirs.unshift(path)
  store.set('recentLocalDirs', dirs.slice(0, 10))
}

export function listRecentLocalDirs(): string[] {
  return store.get('recentLocalDirs')
}

export function clearRecentLocalDirs(): void {
  store.set('recentLocalDirs', [])
}

export function addRecentConnection(connection: RecentSshConnection): void {
  const connections = store
    .get('recentSshConnections')
    .filter(
      (c) => !(c.host === connection.host && c.username === connection.username && c.port === connection.port)
    )
  connections.unshift(connection)
  store.set('recentSshConnections', connections.slice(0, 10))
}

export function listRecentConnections(): RecentSshConnection[] {
  return store.get('recentSshConnections')
}

export function removeRecentConnection(host: string, username: string): void {
  const connections = store
    .get('recentSshConnections')
    .filter((c) => !(c.host === host && c.username === username))
  store.set('recentSshConnections', connections)
}

export function addRecentFile(file: RecentFile): void {
  const files = store.get('recentFiles').filter((f) => f.id !== file.id)
  files.unshift(file)
  store.set('recentFiles', files.slice(0, 10))
}

export function listRecentFiles(): RecentFile[] {
  return store.get('recentFiles')
}

export function clearRecentFiles(): void {
  store.set('recentFiles', [])
}

export function removeRecentFile(id: string): void {
  const files = store.get('recentFiles').filter((f) => f.id !== id)
  store.set('recentFiles', files)
}

export function saveWorkspace(roots: WorkspaceRoot[]): void {
  store.set('workspaceRoots', roots)
}

export function loadWorkspace(): WorkspaceRoot[] {
  return (store.get('workspaceRoots') ?? []) as WorkspaceRoot[]
}

export function getWindowState(): WindowState {
  return store.get('windowState')
}

export function setWindowState(state: WindowState): void {
  store.set('windowState', state)
}

export function getTheme(): ThemeSetting {
  return store.get('theme')
}

export function setTheme(theme: ThemeSetting): void {
  store.set('theme', theme)
}
