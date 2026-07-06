// Kişi detay paneli bileşeni. Kullanıcı listesinde bir çalışan veya yönetici
// adına tıklanınca sağ kenardan kayarak açılan bir panel (drawer) olarak,
// başlıkta DİKEY yerleşimle önce kare bir kişi amblemi (PersonIcon), altında
// o kişinin (büyük harfli) adını ortalanmış olarak gösterir. İçerik şimdilik
// yalnızca bir yer tutucudur; gerçek detay alanları ileride eklenecektir.
// Panel açıkken arkasında üst barın altından başlayan beyaza yakın/hafif buzlu
// bir perde belirir. Kapatma butonu panelin SOL DIŞ kenarına taşan küçük mavi
// bir kutudur; perdeye veya bu butona tıklanınca panel kapanır. Açık/kapalı
// durumu ve gösterilecek kişi üst bileşenden props ile gelir. Yalnızca sunum
// sorumluluğundadır; iş kuralı/hesaplama içermez.

import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import '../styles/kisi-detay.css'

// PersonIcon: kişi göstergesi için sade bir kullanıcı silueti çizer. Üst bardaki
// amblemle aynı biçimdir; ileride kişi fotoğrafını barındırabilecek avatar
// boyutundaki kare amblem içinde yer tutucu olduğundan boyutu buna orantılı
// (72px) büyütülmüştür.
function PersonIcon() {
  return (
    <svg
      width="72"
      height="72"
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

// SagOkIcon: sağa dönük chevron (ok) simgesini çizer. Kapatma kutusunda
// kullanılır; panelin sağa kayıp kapanacağını görsel olarak ima eder.
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
// perdeye veya sol dış kenardaki kapatma kutusuna tıklanınca çağrılır.
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
        <button
          type="button"
          className="kisi-detay-kapat-buton"
          onClick={panelKapat}
          aria-label="Kişi detayını kapat"
        >
          <SagOkIcon />
        </button>

        <div className="kisi-detay-baslik">
          <span className="kisi-detay-amblem"><PersonIcon /></span>
          <h2>{buyukAdSoyad}</h2>
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
