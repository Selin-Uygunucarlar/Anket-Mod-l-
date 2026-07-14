// Korumalı rota sarmalayıcısı. Oturumu olmayan kullanıcıyı giriş ekranına
// yönlendirir; oturum çözülene kadar kısa bir yükleniyor durumu gösterir.
// Yeni korumalı sayfalar bu bileşene sarılarak eklenir (genişletilebilirlik).
// Gerçek yetki kontrolü sunucudadır; buradaki gizleme yalnızca UX içindir.
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import OturumSonaErdiPage from '../pages/OturumSonaErdiPage.jsx'

// GuardliRota: children'ı yalnızca geçerli oturum varsa render eder.
function GuardliRota({ children }) {
  const { oturumKullanici, yukleniyor, oturumSonaErdi } = useAuth()

  // Oturum henüz sunucudan çözülmedi — erken yönlendirme yapmadan bekle.
  if (yukleniyor) {
    return <div className="rota-yukleniyor">Yükleniyor...</div>
  }

  // Oturum yok. Hareketsizlikten yeni sona erdiyse önce bilgi ekranını göster;
  // o ekran süresi dolunca bayrağı temizler ve buraya /login yönlendirmesine düşülür.
  if (!oturumKullanici) {
    if (oturumSonaErdi) {
      return <OturumSonaErdiPage />
    }
    return <Navigate to="/login" replace />
  }

  return children
}

export default GuardliRota
