import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Bosku bisa akses di localhost:3000
    open: true  // Otomatis buka browser saat npm run dev
  },
  build: {
    outDir: 'dist', // Folder hasil akhir untuk di-upload ke Vercel
  }
})
