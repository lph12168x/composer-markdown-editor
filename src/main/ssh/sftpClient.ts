import type { SFTPWrapper } from 'ssh2'

export interface SftpEntry {
  filename: string
  longname: string
  attrs: {
    isDirectory(): boolean
    size: number
    mtime: number
  }
}

function promisify<T>(fn: (cb: (err: Error | null | undefined, result: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export async function sftpReaddir(sftp: SFTPWrapper, path: string): Promise<SftpEntry[]> {
  return promisify((cb) => sftp.readdir(path, cb))
}

export async function sftpReadFile(sftp: SFTPWrapper, path: string): Promise<string> {
  return promisify((cb) => sftp.readFile(path, 'utf8', cb))
}

export async function sftpWriteFile(sftp: SFTPWrapper, path: string, content: string): Promise<void> {
  return promisify((cb) => sftp.writeFile(path, content, 'utf8', cb))
}

export async function sftpMkdir(sftp: SFTPWrapper, path: string): Promise<void> {
  return promisify((cb) => sftp.mkdir(path, cb))
}

export async function sftpCreateFile(sftp: SFTPWrapper, path: string): Promise<void> {
  return promisify((cb) => sftp.writeFile(path, '', 'utf8', cb))
}

export async function sftpUnlink(sftp: SFTPWrapper, path: string): Promise<void> {
  return promisify((cb) => sftp.unlink(path, cb))
}

export async function sftpRmdir(sftp: SFTPWrapper, path: string): Promise<void> {
  return promisify((cb) => sftp.rmdir(path, cb))
}

export async function sftpRename(sftp: SFTPWrapper, oldPath: string, newPath: string): Promise<void> {
  return promisify((cb) => sftp.rename(oldPath, newPath, cb))
}

export async function sftpRealpath(sftp: SFTPWrapper, path: string): Promise<string> {
  return promisify((cb) => sftp.realpath(path, cb))
}

export async function sftpStat(sftp: SFTPWrapper, path: string): Promise<{ size: number; mtime: Date }> {
  const stats = await promisify((cb) => sftp.stat(path, cb))
  return {
    size: stats.size,
    mtime: new Date(stats.mtime * 1000)
  }
}

export async function sftpRemoveRecursive(sftp: SFTPWrapper, path: string): Promise<void> {
  const stats = await promisify((cb) => sftp.stat(path, cb))

  if (!stats.isDirectory()) {
    await sftpUnlink(sftp, path)
    return
  }

  const entries = await sftpReaddir(sftp, path)
  for (const entry of entries) {
    const childPath = `${path}/${entry.filename}`
    if (entry.attrs.isDirectory()) {
      await sftpRemoveRecursive(sftp, childPath)
    } else {
      await sftpUnlink(sftp, childPath)
    }
  }

  await sftpRmdir(sftp, path)
}
