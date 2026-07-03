// Korumalı rota sarmalayıcısı. Oturumu olmayan kullanıcıyı giriş ekranına
// yönlendirir; oturum çözülene kadar kısa bir yükleniyor durumu gösterir.
// Yeni korumalı sayfalar bu bileşene sarılarak eklenir (genişletilebilirlik).
// Gerçek yetki kontrolü sunucudadır; buradaki gizleme yalnızca UX içindir.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

// GuardliRota: children'ı yalnızca geçerli oturum varsa render eder.
function GuardliRota({ children }) {
  const { oturumKullanici, yukleniyor } = useAuth()

  // Oturum henüz sunucudan çözülmedi — erken yönlendirme yapmadan bekle.
  if (yukleniyor) {
    return <div className="rota-yukleniyor">Yükleniyor...</div>
  }

  // Oturum yok — giriş ekranına yönlendir (mevcut geçmişi değiştirerek).
  if (!oturumKullanici) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default GuardliRota
