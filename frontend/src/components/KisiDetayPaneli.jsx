// Kişi detay paneli bileşeni. Kullanıcı listesinde bir çalışan veya yönetici
// adına tıklanınca sağ kenardan kayarak açılan dar bir panel (drawer) olarak,
// o kişinin (büyük harfli) adını başlıkta gösterir. İçerik şimdilik yalnızca
// bir yer tutucudur; gerçek detay alanları ileride eklenecektir. Panel açıkken
// arkasında üst barın altından başlayan beyaza yakın/hafif buzlu bir perde
// belirir; perdeye veya başlıktaki ok butonuna tıklanınca panel kapanır.
// Açık/kapalı durumu ve gösterilecek kişi üst bileşenden props ile gelir.
// Yalnızca sunum sorumluluğundadır; iş kuralı/hesaplama içermez.

import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import '../styles/kisi-detay.css'

// SagOkIcon: sağa dönük chevron (ok) simgesini çizer. Kapatma butonunda
// kullanılır; panelin sağa doğru kapandığını görsel olarak ima eder.
function SagOkIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

// KisiDetayPaneli: seçili kişinin detay panelini ve arkasındaki açık perdeyi
// render eder. props: acik (bool), kisi ({ ad, soyad } | null), panelKapat() ->
// perdeye veya kapatma ok butonuna tıklanınca çağrılır.
function KisiDetayPaneli({ acik, kisi, panelKapat }) {
  // Büyük harfli tam ad; kişi yoksa boş kalır (panel zaten kapalıdır).
  const buyukAdSoyad = kisi
    ? `${buyukHarfeCevir(kisi.ad)} ${buyukHarfeCevir(kisi.soyad)}`.trim()
    : ''

  return (
    <>
      <div
        className={`kisi-detay-overlay${acik ? ' acik' : ''}`}
        onClick={panelKapat}
        aria-hidden="true"
      />
      <aside
        className={`kisi-detay-panel${acik ? ' acik' : ''}`}
        role="dialog"
        aria-label="Kişi detayı"
        aria-hidden={!acik}
      >
        <div className="kisi-detay-baslik">
          <h2>{buyukAdSoyad}</h2>
          <button
            type="button"
            className="kisi-detay-kapat-buton"
            onClick={panelKapat}
            aria-label="Kişi detayını kapat"
          >
            <SagOkIcon />
          </button>
        </div>

        <div className="kisi-detay-icerik">
          <p className="kisi-detay-yer-tutucu">
            Detay içeriği ileride eklenecek.
          </p>
        </div>
      </aside>
    </>
  )
}

export default KisiDetayPaneli
