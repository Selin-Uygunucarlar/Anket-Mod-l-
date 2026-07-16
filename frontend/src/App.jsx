// Uygulamanın rota tanımı. Yalnızca hangi yolun hangi sayfayı gösterdiğini
// belirler; iş mantığı içermez. Korumalı sayfalar GuardliRota ile sarılır.
// Ana ekran ('/') bir KABUK/layout rotasıdır (AnaSayfaPage): iç ekranlar onun
// <Outlet/>'ine düşen alt rotalardır ve her biri gerçek bir URL taşır (tarayıcı
// geri/ileri oku uygulama içinde çalışsın). /yonetim/* alt rotaları AdminGuard ile
// yalnızca admin'e açıktır. Alt rotaların içerik bileşenlerini doğru proplarla
// saran ince "rota elemanları" routes/YonetimRotaElemanlari.jsx'tedir.
// Yeni sayfa eklemek = buraya bir <Route> eklemek (gevşek bağlı, genişletilebilir).
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage.jsx'
import AnaSayfaPage from './pages/AnaSayfaPage.jsx'
import SifreBelirlePage from './pages/SifreBelirlePage.jsx'
import SoruSecPage from './pages/SoruSecPage.jsx'
import AnketKullaniciSecPage from './pages/AnketKullaniciSecPage.jsx'
import AnketGrupSecPage from './pages/AnketGrupSecPage.jsx'
import GuardliRota from './auth/GuardliRota.jsx'
import { useAuth } from './auth/AuthContext.jsx'
import {
  AdminGuard,
  AnaEkranGorunumu,
  KullaniciListesiRota,
  KullaniciEkleRota,
  KullaniciDuzenleRota,
  KullaniciGruplariRota,
  AnketListesiRota,
  AnketEkleRota,
  AnketDuzenleRota,
  SoruListesiRota,
  SoruEkleRota,
  SoruDuzenleRota,
  KullaniciSecenekAyarlariRota,
  SoruSecenekAyarlariRota,
  GrupTanimlariRota,
} from './routes/YonetimRotaElemanlari.jsx'

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

      {/* Korumalı anasayfa KABUĞU (layout): yalnızca oturumu olan kullanıcı erişir.
          Bayrak true iken zorunlu şifre belirlemeye yönlendirilir (Navigate render
          edilince alt rotalar çizilmez). İç ekranlar bu kabuğun <Outlet/>'ine düşen
          alt rotalardır; her biri gerçek bir URL taşır (tarayıcı geri/ileri oku
          uygulama içinde çalışsın). /yonetim/* alt rotaları AdminGuard ile yalnızca
          admin'e açıktır (UX/savunma derinliği; asıl yetki sunucuda). */}
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
      >
        {/* Ana ekran: giriş yapan herkese atanmış anket paneli. */}
        <Route index element={<AnaEkranGorunumu />} />

        {/* Kullanıcı yönetimi (admin). */}
        <Route
          path="yonetim/kullanicilar"
          element={
            <AdminGuard>
              <KullaniciListesiRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/kullanicilar/ekle"
          element={
            <AdminGuard>
              <KullaniciEkleRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/kullanicilar/:sicil/duzenle"
          element={
            <AdminGuard>
              <KullaniciDuzenleRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/kullanici-gruplari"
          element={
            <AdminGuard>
              <KullaniciGruplariRota />
            </AdminGuard>
          }
        />

        {/* Anketler (admin). */}
        <Route
          path="yonetim/anketler"
          element={
            <AdminGuard>
              <AnketListesiRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/anketler/ekle"
          element={
            <AdminGuard>
              <AnketEkleRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/anketler/:anketId/duzenle"
          element={
            <AdminGuard>
              <AnketDuzenleRota />
            </AdminGuard>
          }
        />

        {/* Anket soruları (admin). */}
        <Route
          path="yonetim/sorular"
          element={
            <AdminGuard>
              <SoruListesiRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/sorular/ekle"
          element={
            <AdminGuard>
              <SoruEkleRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/sorular/:soruId/duzenle"
          element={
            <AdminGuard>
              <SoruDuzenleRota />
            </AdminGuard>
          }
        />

        {/* Ayarlar (admin). */}
        <Route
          path="yonetim/ayarlar/kullanici-secenekleri"
          element={
            <AdminGuard>
              <KullaniciSecenekAyarlariRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/ayarlar/soru-secenekleri"
          element={
            <AdminGuard>
              <SoruSecenekAyarlariRota />
            </AdminGuard>
          }
        />
        <Route
          path="yonetim/ayarlar/grup-tanimlari"
          element={
            <AdminGuard>
              <GrupTanimlariRota />
            </AdminGuard>
          }
        />
      </Route>

      {/* Korumalı soru seçme ekranı: anket formundan YENİ SEKMEDE açılır. Ayrı bir
          rotadır çünkü anasayfa görünümleri state ile değişir, yeni sekme ise
          gerçek bir URL ister. Şifre belirleme bayrağı diğer korumalı yollarla
          aynı şekilde gözetilir. */}
      <Route
        path="/anket-sorulari-sec"
        element={
          <GuardliRota>
            {sifreBelirlemeGerek ? (
              <Navigate to="/sifre-belirle" replace />
            ) : (
              <SoruSecPage />
            )}
          </GuardliRota>
        }
      />

      {/* Korumalı kullanıcı seçme ekranı: anket formunun "Kullanıcılar" kartından
          YENİ SEKMEDE açılır (soru seçme ekranıyla aynı gerekçe: yeni sekme
          gerçek bir URL ister). Şifre belirleme bayrağı aynı şekilde gözetilir. */}
      <Route
        path="/anket-kullanicilari-sec"
        element={
          <GuardliRota>
            {sifreBelirlemeGerek ? (
              <Navigate to="/sifre-belirle" replace />
            ) : (
              <AnketKullaniciSecPage />
            )}
          </GuardliRota>
        }
      />

      {/* Korumalı grup seçme ekranı: anket formunun "Kullanıcılar" kartından YENİ
          SEKMEDE açılır. Kalıp diğer seçme ekranlarıyla birebir aynıdır. */}
      <Route
        path="/anket-gruplari-sec"
        element={
          <GuardliRota>
            {sifreBelirlemeGerek ? (
              <Navigate to="/sifre-belirle" replace />
            ) : (
              <AnketGrupSecPage />
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
