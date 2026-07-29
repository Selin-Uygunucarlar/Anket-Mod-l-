// React uygulamasının kök giriş noktası.
// React ağacını #root'a bağlar ve alt bileşenleri sağlayıcılarla sarar:
// ConfigProvider (Ant Design teması + Türkçe yerelleştirme), antd App (statik
// Modal/message çağrılarının temayı ve locale'i görmesi için), QueryClientProvider
// (sunucu istekleri), BrowserRouter (çok-sayfalı navigasyon) ve AuthProvider
// (oturum durumu). Sağlayıcı sırası: görünüm > veri > yönlendirme > oturum.
// CSS SIRASI ÖNEMLİ: antd'nin reset'i ÖNCE, projenin kendi login.css'i SONRA
// içeri alınır; aksi halde projenin genel (body/box-sizing) kuralları ezilir.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import trTR from 'antd/locale/tr_TR'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ANTD_TEMASI } from './common/antdTema.js'
import 'antd/dist/reset.css'
import './styles/login.css'

// Tek bir React Query istemcisi; tüm mutation/query'ler bunu paylaşır.
const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={ANTD_TEMASI} locale={trTR}>
      {/* component={false}: antd App'in DOM'a fazladan bir sarmalayıcı <div>
          eklemesini önler. O <div> yazı tipi/boyutunu (14px) tüm ağaca dayatır ve
          antd'ye taşınmamış ekranların görünümünü değiştirirdi; bu iş SALT görsel
          bir taşımadır ve kapsam dışı ekranlar aynı kalmalıdır. Statik yerine
          App.useApp() ile kullanılan modal yine temayı ve locale'i görür.
          antd bu seçimde geliştirme konsolunda bir "cssVar" uyarısı basar; yalnızca
          geliştirme uyarısıdır, üretim paketine girmez. */}
      <AntdApp component={false}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
