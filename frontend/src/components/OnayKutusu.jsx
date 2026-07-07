// Ekranın ortasında beliren sade bir onay modalı. Kritik bir işlemden (ör.
// kullanıcı durumunu değiştirme) önce kullanıcıdan açık onay toplar. Yalnızca
// gösterim ve onay/vazgeç girdisi toplar; iş kuralı, yetki veya hesaplama
// İÇERMEZ (kararı çağıran bileşen ve sunucu verir). Perdeye tıklama, "Vazgeç"
// ve Escape ile kapanır; onay butonu işlem sürerken devre dışıdır.

import { useEffect, useRef } from 'react'
import '../styles/onay-kutusu.css'

// OnayKutusu: ortalanmış onay modalını render eder.
// props: baslik, mesaj -> gösterilecek metinler; onaylaMetni -> onay butonu
// etiketi (ör. "Pasif yap"); onOnayla() -> onay butonuna basınca; onVazgec()
// -> perde/Vazgeç/Escape ile kapanınca; islemAktif (bool) -> istek sürerken
// butonları devre dışı bırakır.
function OnayKutusu({ baslik, mesaj, onaylaMetni, onOnayla, onVazgec, islemAktif }) {
  const onayButonRef = useRef(null)

  // Modal açılınca onay butonuna odaklan (klavye erişilebilirliği) ve Escape
  // ile kapanmayı dinle. Perdeye tıklama ayrı olarak overlay onClick'te ele
  // alınır. Yalnızca UX; güvenlik sınırı değildir.
  useEffect(() => {
    onayButonRef.current?.focus()

    // kapatEscape: Escape tuşuna basılınca vazgeç akışını tetikler.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        onVazgec()
      }
    }

    document.addEventListener('keydown', kapatEscape)
    return () => document.removeEventListener('keydown', kapatEscape)
  }, [onVazgec])

  // perdeyeTiklandi: yalnızca perdenin kendisine (kutunun dışına) tıklanınca
  // kapatır; kutu içine yapılan tıklamalar yayılmaz.
  function perdeyeTiklandi(olay) {
    if (olay.target === olay.currentTarget) {
      onVazgec()
    }
  }

  return (
    <div className="onay-perde" onClick={perdeyeTiklandi}>
      <div
        className="onay-kutu"
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
      >
        <h3 className="onay-kutu-baslik">{baslik}</h3>
        <p className="onay-kutu-mesaj">{mesaj}</p>
        <div className="onay-kutu-butonlar">
          <button
            type="button"
            className="onay-vazgec-buton"
            onClick={onVazgec}
            disabled={islemAktif}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className="onay-onayla-buton"
            onClick={onOnayla}
            disabled={islemAktif}
            ref={onayButonRef}
          >
            {islemAktif ? 'İşleniyor...' : onaylaMetni}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OnayKutusu
