// React uygulamasının kök giriş noktası.
// React ağacını #root'a bağlar ve alt bileşenleri sağlayıcılarla sarar:
// QueryClientProvider (sunucu istekleri), BrowserRouter (çok-sayfalı navigasyon)
// ve AuthProvider (oturum durumu). Sağlayıcı sırası: veri > yönlendirme > oturum.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import './styles/login.css'

// Tek bir React Query istemcisi; tüm mutation/query'ler bunu paylaşır.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
