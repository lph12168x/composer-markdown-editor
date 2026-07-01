export function posixJoin(...segments: string[]): string {
  const joined = segments
    .map((s) => s.replace(/\/+$/, ''))
    .filter((s) => s.length > 0)
    .join('/')
  if (segments[0]?.startsWith('/')) {
    return '/' + joined.replace(/^\/+/, '')
  }
  return joined
}

export function posixBasename(p: string): string {
  return p.replace(/\/$/, '').split('/').pop() || p
}

export function posixDirname(p: string): string {
  const trimmed = p.replace(/\/$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx <= 0) return '/'
  return trimmed.slice(0, idx) || '/'
}
