// Hareketsizlik nedeniyle oturum sonlandığında araya giren tam ekran UX ekranı.
// Kullanıcıyı bilgilendirir ve kısa bir süre sonra oturum bildirimini temizleyerek
// login'e geçişi tetikler. Yönlendirme kararı GuardliRota'da; bu ekran elle
// navigate etmez. İş kuralı içermez, yalnızca gösterim ve zamanlayıcı.
import { useEffect } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import '../styles/oturum-sona-erdi.css'

// Bilgi ekranının görünme süresi (ms); dolunca login'e geçiş tetiklenir.
const OTURUM_BILDIRIM_SURESI_MS = 5000

// OturumSonaErdiPage: bilgilendirme ekranını gösterir ve süre dolunca oturum
// bildirimini temizler (GuardliRota bunu görüp /login'e yönlendirir).
function OturumSonaErdiPage() {
  const { oturumBildiriminiTemizle } = useAuth()

  // Mount'ta bir kez zamanlayıcı kurar; süre dolunca bildirimi temizler.
  // Bileşen sökülürse zamanlayıcı iptal edilir (çift tetikleme olmaz).
  useEffect(() => {
    const zamanlayici = setTimeout(
      oturumBildiriminiTemizle,
      OTURUM_BILDIRIM_SURESI_MS,
    )
    return () => clearTimeout(zamanlayici)
  }, [oturumBildiriminiTemizle])

  return (
    <div
      className="oturum-sona-erdi-page"
      role="status"
      aria-live="polite"
    >
      <div className="oturum-sona-erdi-kart">
        <h1 className="oturum-sona-erdi-baslik">Oturumunuz sonlandırıldı</h1>
        <p className="oturum-sona-erdi-aciklama">
          Uzun süre işlem yapılmadığı için güvenlik amacıyla çıkış yapıldı.
          Giriş ekranına yönlendiriliyorsunuz…
        </p>
      </div>
    </div>
  )
}

export default OturumSonaErdiPage
