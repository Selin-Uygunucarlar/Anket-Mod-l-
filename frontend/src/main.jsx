// React uygulamasının kök giriş noktası.
// React ağacını #root'a bağlar ve tüm alt bileşenleri React Query'nin
// QueryClientProvider'ı ile sarar (sunucu istekleri buradan yönetilir).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './styles/login.css'

// Tek bir React Query istemcisi; tüm mutation/query'ler bunu paylaşır.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
