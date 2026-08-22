import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Plain web build of the renderer (the same React app that used to run inside
// Electron). It talks to the local Node server in ./server via HTTP instead of
// Electron IPC — see src/renderer/src/lib/browserApi.ts, which installs
// window.api before the app boots. Output goes to ./dist, which the server
// serves as static files.
export default defineConfig({
  root: resolve('src/renderer'),
  base: './',
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react(), tailwindcss()]
})
