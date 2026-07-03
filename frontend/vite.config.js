// Vite yapılandırması: React (JSX) desteğini etkinleştirir.
// Sunum/UI katmanının derleme ve geliştirme sunucusu ayarlarını içerir.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
