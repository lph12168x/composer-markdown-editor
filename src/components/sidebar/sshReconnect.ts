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

/**
 * Main-process SFTP helpers throw `SSH connection is not established` once
 * the session has dropped, and Electron IPC embeds that message in the
 * renderer-side error. Read-only tree operations use this to tell "session
 * died" (worth a reconnect prompt + one retry) apart from ordinary
 * filesystem errors (report as-is).
 */
export function isSshConnectionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes('SSH connection is not established')
}

/**
 * `ensureSshConnected` rejects with this message when the user dismisses
 * the re-authentication modal. Callers treat it as "operation aborted on
 * purpose" and stay quiet instead of stacking an alert on top of the modal
 * the user just closed.
 */
export const SSH_RECONNECT_CANCELLED_MESSAGE = 'SSH re-authentication was cancelled'

export function isSshReconnectCancelled(err: unknown): boolean {
  return err instanceof Error && err.message === SSH_RECONNECT_CANCELLED_MESSAGE
}