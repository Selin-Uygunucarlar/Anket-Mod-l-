// Kişi menüsü bileşeni. Üst barda oturum sahibinin adını (ikon + ad soyad)
// gösteren bir tetikleyici buton ve tıklanınca açılan küçük dropdown içerir.
// Dropdown'daki "Çıkış Yap" seçeneği oturumu kapatır. Yalnızca gösterim ve
// kullanıcı etkileşimi toplar; yönlendirme/iş mantığı içermez.
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

// PersonIcon: kişi göstergesi için sade bir kullanıcı silueti çizer.
function PersonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

// KisiMenu: oturum kullanıcısını gösterir ve çıkış seçeneğini sunar.
// props: adminPaneliniKapat() -> kişi menüsü açılırken varsa açık admin
//   panelini kapatmak için çağrılır; böylece dropdown panelin önünde görünür.
function KisiMenu({ adminPaneliniKapat }) {
  const { oturumKullanici, cikisYap } = useAuth()
  const [acik, setAcik] = useState(false)
  const menuRef = useRef(null)

  // Oturum adı; session boşsa güvenli bir yer tutucu gösterilir (teknik
  // detay sızdırılmaz). Ad/soyad session'dan okunur.
  const goruntuAd = oturumKullanici
    ? `${oturumKullanici.ad ?? ''} ${oturumKullanici.soyad ?? ''}`.trim()
    : ''
  const gosterilenAd = goruntuAd || 'Kullanıcı'

  // Menü açıkken dışarı tıklama ve Escape ile kapanmasını sağlar; kapalıyken
  // dinleyici bağlanmaz (gereksiz iş yapılmaz).
  useEffect(() => {
    if (!acik) {
      return
    }

    // kapatDisTiklama: menü dışında bir yere tıklanınca menüyü kapatır.
    function kapatDisTiklama(olay) {
      if (menuRef.current && !menuRef.current.contains(olay.target)) {
        setAcik(false)
      }
    }

    // kapatEscape: Escape tuşuna basılınca menüyü kapatır.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        setAcik(false)
      }
    }

    document.addEventListener('mousedown', kapatDisTiklama)
    document.addEventListener('keydown', kapatEscape)
    return () => {
      document.removeEventListener('mousedown', kapatDisTiklama)
      document.removeEventListener('keydown', kapatEscape)
    }
  }, [acik])

  // toggleMenu: kişi menüsünün açık/kapalı durumunu değiştirir. Menü
  // etkileşiminde varsa açık admin panelini kapatır ki dropdown önde kalsın;
  // callback tanımsız veya panel zaten kapalıysa çağrı zararsızdır.
  function toggleMenu() {
    adminPaneliniKapat?.()
    setAcik((oncekiDurum) => !oncekiDurum)
  }

  // handleCikis: menüyü kapatır ve oturumu sonlandırır. Giriş ekranına dönüş
  // GuardliRota tarafından otomatik yapılır; burada yönlendirme yazılmaz.
  function handleCikis() {
    setAcik(false)
    cikisYap()
  }

  return (
    <div className="kisi-menu" ref={menuRef}>
      <button
        type="button"
        className="kisi-gosterge"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={acik}
      >
        <span className="kisi-amblem"><PersonIcon /></span>
        <span className="kisi-ad">{gosterilenAd}</span>
      </button>

      {acik && (
        <div className="kisi-dropdown" role="menu">
          <button
            type="button"
            className="kisi-dropdown-oge"
            role="menuitem"
            onClick={handleCikis}
          >
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  )
}

export default KisiMenu
