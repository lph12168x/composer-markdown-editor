import { app, BrowserWindow, shell } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { buildAppMenu } from './menu'

// Dev-only workaround for Linux VMs / rootless containers that lack a working GPU / VAAPI.
if (process.env.COMPOSER_DEV_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('disable-accelerated-video-decode')
  app.commandLine.appendSwitch('disable-accelerated-video-encode')
  app.commandLine.appendSwitch(
    'disable-features',
    'VaapiVideoDecoder,VaapiVideoEncoder,VaapiVideoDecodeLinuxGL,VaapiVideoDecoderLinuxGL,AcceleratedVideoDecodeLinuxGL,AcceleratedVideoEncoder'
  )
}

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
