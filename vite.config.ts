import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Proxies to a standalone functions server (start it separately: `netlify functions:serve`, default port 9999).
    proxy: {
      '/api': 'http://localhost:9999',
    },
  },
})