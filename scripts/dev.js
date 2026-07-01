const { spawn } = require('child_process')
const path = require('path')

const electronVite = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-vite')
const args = ['dev']

if (process.platform === 'linux') {
  // Linux development environments (especially VMs / rootless containers) often fail to
  // initialize the GPU sandbox / VAAPI. Disable hardware acceleration for stable dev startup.
  process.env.LIBVA_DRIVER_NAME = 'null'
  process.env.VDPAU_DRIVER = 'disable'
  process.env.COMPOSER_DEV_DISABLE_GPU = '1'

  args.push(
    '--',
    '--no-sandbox',
    '--no-zygote',
    '--ozone-platform=x11',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-accelerated-video-decode',
    '--disable-accelerated-video-encode'
  )
}

const child = spawn(electronVite, args, {
  stdio: 'inherit'
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (err) => {
  console.error('Failed to start dev server:', err)
  process.exit(1)
})
