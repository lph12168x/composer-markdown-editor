import { create } from 'zustand'
import type { SshConnectionConfig, SshConnectionStatus } from '../types/ssh'
import { SSH_CHANNELS } from '../types/ipc'
import { settingsClient } from '../services/settingsClient'

interface SshState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  host: string | null
  username: string | null
  connect: (config: SshConnectionConfig) => Promise<SshConnectionStatus & { homePath: string }>
  disconnect: () => Promise<void>
  fetchStatus: () => Promise<void>
}

export const useSshStore = create<SshState>((set) => ({
  isConnected: false,
  isConnecting: false,
  error: null,
  host: null,
  username: null,

  connect: async (config: SshConnectionConfig) => {
    set({ isConnecting: true, error: null })
    try {
      const result = await window.electronAPI.invoke<{ status: SshConnectionStatus; homePath: string }>(
        SSH_CHANNELS.CONNECT,
        config
      )
      set({
        isConnected: result.status.connected,
        isConnecting: false,
        error: null,
        host: result.status.host || null,
        username: result.status.username || null
      })

      void settingsClient.addRecentConnection({
        host: config.host,
        port: config.port,
        username: config.username,
        authType: config.auth === 'privateKey' ? 'key' : config.auth,
        privateKeyPath: config.auth === 'privateKey' ? config.privateKeyPath : undefined
      })

      return { ...result.status, homePath: result.homePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect'
      set({
        isConnected: false,
        isConnecting: false,
        error: message,
        host: null,
        username: null
      })
      throw new Error(message)
    }
  },

  disconnect: async () => {
    await window.electronAPI.invoke<SshConnectionStatus>(SSH_CHANNELS.DISCONNECT)
    set({
      isConnected: false,
      isConnecting: false,
      error: null,
      host: null,
      username: null
    })
  },

  fetchStatus: async () => {
    try {
      const status = await window.electronAPI.invoke<SshConnectionStatus>(SSH_CHANNELS.STATUS)
      set({
        isConnected: status.connected,
        host: status.host || null,
        username: status.username || null
      })
    } catch (err) {
      console.error('Failed to fetch SSH status:', err)
    }
  }
}))
