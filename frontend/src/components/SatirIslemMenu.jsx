// Kullanıcı listesi tablosunda bir satırın "İşlemler" hücresindeki üç nokta (⋮)
// menüsü. Butona tıklanınca küçük bir dropdown açar; dışarı tıklama ve Escape
// ile kapanır. Menüde iki öğe vardır: (1) "Düzenle" — kullanıcının bilgilerini
// düzenleme ekranını açar; (2) aktiflik öğesi — kullanıcı aktifse "Pasif yap",
// pasifse "Aktif yap". Bir öğe seçilince ilgili callback ile üst bileşene haber
// verir (onDuzenle / onSecim); asıl düzenleme ve durum değişimi/onayı üst
// bileşende ve sunucuda ele alınır. Yalnızca gösterim ve etkileşim toplar; iş
// kuralı veya yetki İÇERMEZ.

import { useEffect, useRef } from 'react'

// UcNoktaIcon: dikey üç nokta (⋮) simgesini çizer.
function UcNoktaIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}

// SatirIslemMenu: bir satırın işlem menüsünü render eder.
// props: acik (bool) -> bu satırın menüsü açık mı; aktif (bool) -> kullanıcının
// aktiflik durumu (aktiflik öğesinin etiketini belirler); onAc() -> ⋮ butonuna
// tıklanınca (üst bileşen açık satırı yönetir); onKapat() -> dışarı tıkla/Escape
// ile; onDuzenle() -> "Düzenle" seçilince (üst bileşen düzenleme ekranını açar);
// onSecim() -> aktiflik öğesi seçilince (üst bileşen onay kutusunu açar).
function SatirIslemMenu({ acik, aktif, onAc, onKapat, onDuzenle, onSecim }) {
  const menuRef = useRef(null)

  // Menü açıkken dışarı tıklama ve Escape ile kapanmasını sağlar; kapalıyken
  // dinleyici bağlanmaz (gereksiz iş yapılmaz).
  useEffect(() => {
    if (!acik) {
      return
    }

    // kapatDisTiklama: menü dışında bir yere tıklanınca kapatır.
    function kapatDisTiklama(olay) {
      if (menuRef.current && !menuRef.current.contains(olay.target)) {
        onKapat()
      }
    }

    // kapatEscape: Escape tuşuna basılınca kapatır.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        onKapat()
      }
    }

    document.addEventListener('mousedown', kapatDisTiklama)
    document.addEventListener('keydown', kapatEscape)
    return () => {
      document.removeEventListener('mousedown', kapatDisTiklama)
      document.removeEventListener('keydown', kapatEscape)
    }
  }, [acik, onKapat])

  const ogeMetni = aktif ? 'Pasif yap' : 'Aktif yap'

  return (
    <div className="kullanici-islem-sarmalayici" ref={menuRef}>
      <button
        type="button"
        className="kullanici-islem-buton"
        onClick={onAc}
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label="İşlemler menüsü"
      >
        <UcNoktaIcon />
      </button>

      {acik && (
        <div className="kullanici-islem-dropdown" role="menu">
          <button
            type="button"
            className="kullanici-islem-oge"
            role="menuitem"
            onClick={onDuzenle}
          >
            Düzenle
          </button>
          <button
            type="button"
            className="kullanici-islem-oge"
            role="menuitem"
            onClick={onSecim}
          >
            {ogeMetni}
          </button>
        </div>
      )}
    </div>
  )
}

export default SatirIslemMenu
