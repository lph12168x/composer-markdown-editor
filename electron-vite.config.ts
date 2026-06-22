import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      lib: {
        entry: path.resolve(__dirname, 'src/main/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      lib: {
        entry: path.resolve(__dirname, 'src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.js'
      }
    }
  },
  renderer: {
    root: path.resolve(__dirname, 'src'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
