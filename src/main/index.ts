import { app, BrowserWindow, shell } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { buildAppMenu } from './menu'

// Disable GPU hardware acceleration to avoid issues in VMs / WSL / headless environments
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder')

// Security: prevent new window creation from renderer
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault()
    shell.openExternal(navigationUrl)
  })

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()
  buildAppMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
