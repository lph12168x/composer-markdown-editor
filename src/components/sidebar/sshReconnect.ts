import { createContext, useContext } from 'react'
import type { RecentSshConnection } from '../../types/ipc'
import type { WorkspaceRoot } from '../../types/file'

/**
 * Capability exposed to descendants of `WorkspacePanel` so they can ask
 * for an SSH reconnect before they attempt any SFTP I/O. Used by
 * `FileTree` and `TreeNode` to recover the browsing session that was left
 * open the last time the app ran — clicking the workspace entry, the
 * tree chevron, or the refresh button all flow through this hook.
 *
 * The function returns immediately if SSH is already connected,
 * otherwise it locates the matching recent connection, prompts the user
 * for the password (via `SshConnectModal`), and resolves once the
 * connection is back up. Rejects if the user cancels the prompt or no
 * saved connection can be found for the active root.
 */
export interface SshReconnectApi {
  /**
   * Make sure SSH is connected before the caller proceeds. If a recent
   * connection is supplied it is used directly; otherwise we look up
   * the one bound to the currently active SSH session via host +
   * username.
   */
  ensureSshConnected(connection?: RecentSshConnection | null): Promise<void>
  /**
   * Find the saved `RecentSshConnection` that matches a given workspace
   * root, so children of `<WorkspacePanel />` can resolve their root
   * back to the credential set it was opened under.
   */
  findConnectionForRoot(root: WorkspaceRoot): Promise<RecentSshConnection | null>
}

export const SshReconnectContext = createContext<SshReconnectApi | null>(null)

export function useSshReconnect(): SshReconnectApi | null {
  return useContext(SshReconnectContext)
}