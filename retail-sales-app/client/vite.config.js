import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
    // Allows access via a tunnel (e.g. ngrok/cloudflared), which forwards a
    // public hostname Vite would otherwise reject as an unrecognized Host header.
    allowedHosts: true,
    // Listen on all network interfaces, not just localhost, so other devices
    // on the same WiFi/LAN can reach this dev server via your computer's IP.
    host: true,
  },
})
