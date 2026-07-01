import type { FileRef, WorkspaceRoot } from './file'

export const FS_CHANNELS = {
  READ_DIR: 'fs:readDir',
  READ_FILE: 'fs:readFile',
  WRITE_FILE: 'fs:writeFile',
  CREATE_FILE: 'fs:createFile',
  CREATE_DIR: 'fs:createDir',
  RENAME: 'fs:rename',
  DELETE: 'fs:delete',
  STAT: 'fs:stat'
} as const

export interface ReadDirPayload {
  root: WorkspaceRoot
  ref: FileRef
}

export interface WriteFilePayload {
  ref: FileRef
  content: string
}

export interface CreatePayload {
  parent: FileRef
  name: string
}

export interface RenamePayload {
  ref: FileRef
  newName: string
}

export const SSH_CHANNELS = {
  CONNECT: 'ssh:connect',
  DISCONNECT: 'ssh:disconnect',
  STATUS: 'ssh:status'
} as const

export const GIT_CHANNELS = {
  STATUS: 'git:status',
  INIT: 'git:init',
  COMMIT: 'git:commit',
  STAGE: 'git:stage',
  UNSTAGE: 'git:unstage',
  LOG: 'git:log',
  DIFF: 'git:diff',
  BRANCHES: 'git:branches',
  CHECKOUT: 'git:checkout'
} as const

export const SETTINGS_CHANNELS = {
  GET: 'settings:get',
  SET: 'settings:set',
  RECENT_DIR_ADD: 'settings:recentDir:add',
  RECENT_DIRS_LIST: 'settings:recentDirs:list',
  RECENT_DIRS_CLEAR: 'settings:recentDirs:clear',
  RECENT_CONNECTION_ADD: 'settings:recentConnection:add',
  RECENT_CONNECTIONS_LIST: 'settings:recentConnections:list',
  RECENT_CONNECTION_REMOVE: 'settings:recentConnection:remove',
  RECENT_FILE_ADD: 'settings:recentFile:add',
  RECENT_FILES_LIST: 'settings:recentFiles:list',
  RECENT_FILES_CLEAR: 'settings:recentFiles:clear',
  RECENT_FILE_REMOVE: 'settings:recentFile:remove',
  WORKSPACE_SAVE: 'settings:workspace:save',
  WORKSPACE_LOAD: 'settings:workspace:load'
} as const

export interface RecentSshConnection {
  host: string
  port: number
  username: string
  authType: 'password' | 'key' | 'agent'
  privateKeyPath?: string
}

export interface RecentFile {
  id: string
  rootId: string
  type: 'local' | 'ssh'
  path: string
  name: string
}

export interface WindowState {
  width: number
  height: number
  maximized?: boolean
}

export type ThemeSetting = 'light' | 'dark'

export interface SettingsSchema {
  recentLocalDirs: string[]
  recentSshConnections: RecentSshConnection[]
  recentFiles: RecentFile[]
  windowState: WindowState
  theme: ThemeSetting
}

export const APP_CHANNELS = {
  MODIFIED: 'app:modified',
  PROMPT_CLOSE: 'app:prompt-close',
  CLOSE_ALLOWED: 'app:close-allowed',
  FILE_CHANGED: 'fs:fileChanged'
} as const

export const MENU_CHANNELS = {
  OPEN_FOLDER: 'menu:open-folder',
  OPEN_RECENT_FOLDER: 'menu:open-recent-folder',
  OPEN_RECENT_FILE: 'menu:open-recent-file',
  OPEN_RECENT_SSH: 'menu:open-recent-ssh'
} as const
