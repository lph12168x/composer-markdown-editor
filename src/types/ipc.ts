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
