// Uygulamanın rota tanımı. Yalnızca hangi yolun hangi sayfayı gösterdiğini
// belirler; iş mantığı içermez. Korumalı sayfalar GuardliRota ile sarılır.
// Yeni sayfa eklemek = buraya bir <Route> eklemek (gevşek bağlı, genişletilebilir).
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import AnaSayfaPage from './pages/AnaSayfaPage.jsx'
import SifreBelirlePage from './pages/SifreBelirlePage.jsx'
import GuardliRota from './auth/GuardliRota.jsx'
import { useAuth } from './auth/AuthContext.jsx'

// App: aktif oturuma göre rotaları çözer. Geçici şifreyle giren kullanıcı
// (sifre_degistirilmeli === true) kalıcı şifresini belirleyene kadar yalnızca
// /sifre-belirle'ye erişebilir; diğer korumalı yollar oraya yönlendirilir.
// Bu bir UX/akış yönlendirmesidir; asıl kısıt sunucuda uygulanır.
function App() {
  const { oturumKullanici } = useAuth()
  const sifreBelirlemeGerek = oturumKullanici?.sifre_degistirilmeli === true

  return (
    <Routes>
      {/* Girişliyken /login'e gelinirse anasayfaya yönlendir (UX). */}
      <Route
        path="/login"
        element={oturumKullanici ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Zorunlu şifre belirleme: yalnızca oturumlu + bayrak true iken anlamlı.
          Bayrak false ise anasayfaya yönlendirilir. */}
      <Route
        path="/sifre-belirle"
        element={
          <GuardliRota>
            {sifreBelirlemeGerek ? (
              <SifreBelirlePage />
            ) : (
              <Navigate to="/" replace />
            )}
          </GuardliRota>
        }
      />

      {/* Korumalı anasayfa: yalnızca oturumu olan kullanıcı erişir. Bayrak true
          iken zorunlu şifre belirlemeye yönlendirilir. */}
      <Route
        path="/"
        element={
          <GuardliRota>
            {sifreBelirlemeGerek ? (
              <Navigate to="/sifre-belirle" replace />
            ) : (
              <AnaSayfaPage />
            )}
          </GuardliRota>
        }
      />

      {/* Bilinmeyen yol: oturuma göre anasayfaya ya da girişe yönlendir.
          Anasayfa rotası, bayrak true iken şifre belirlemeye yönlendirir. */}
      <Route
        path="*"
        element={<Navigate to={oturumKullanici ? '/' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
