// Uygulamanın rota tanımı. Yalnızca hangi yolun hangi sayfayı gösterdiğini
// belirler; iş mantığı içermez. Korumalı sayfalar GuardliRota ile sarılır.
// Yeni sayfa eklemek = buraya bir <Route> eklemek (gevşek bağlı, genişletilebilir).
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import AnaSayfaPage from './pages/AnaSayfaPage.jsx'
import GuardliRota from './auth/GuardliRota.jsx'
import { useAuth } from './auth/AuthContext.jsx'

// App: aktif oturuma göre rotaları çözer.
function App() {
  const { oturumKullanici } = useAuth()

  return (
    <Routes>
      {/* Girişliyken /login'e gelinirse anasayfaya yönlendir (UX). */}
      <Route
        path="/login"
        element={oturumKullanici ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Korumalı anasayfa: yalnızca oturumu olan kullanıcı erişir. */}
      <Route
        path="/"
        element={
          <GuardliRota>
            <AnaSayfaPage />
          </GuardliRota>
        }
      />

      {/* Bilinmeyen yol: oturuma göre anasayfaya ya da girişe yönlendir. */}
      <Route
        path="*"
        element={<Navigate to={oturumKullanici ? '/' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
