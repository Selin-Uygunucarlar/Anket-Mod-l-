// Admin paneli bileşeni. Sağ kenardan kayarak açılan dar bir panel (drawer)
// olarak, başlık, kapatma butonu ve yer tutucu yönetim seçeneklerini gösterir.
// Seçenekler ya düz bir butondur ya da açılıp kapanabilen bir gruptur. Gruplar
// İKİ SEVİYE iç içe olabilir: bir grubun alt seçeneği hem düz bir yaprak
// (işlevsiz buton) hem de kendi alt seçeneklerini taşıyan iç içe bir grup
// olabilir ("Kullanıcı Yönetimi > Kullanıcı Listeleri > Kullanıcı Listesi").
// Her grubun açık/kapalı durumu bağımsızdır ve bileşen içinde saf UI state
// olarak tutulur. Panel açıkken üst barın altından başlayan, beyaza yakın/hafif
// buzlu açık bir perde sayfayı örter (karartmaz). Perdeye veya başlıktaki ok
// butonuna tıklanınca panel kapanır. Panelin açık/kapalı durumu üst bileşenden
// (AnaSayfaPage) props ile gelir. Seçenekler şimdilik işlevsiz görsel yer
// tutuculardır. Yalnızca gösterim sorumluluğundadır.

import { useState } from 'react'

// Panelde gösterilecek yönetim seçenekleri. altSecenekler taşıyan öğe, açılıp
// kapanabilen bir grup olarak render edilir. altSecenekler öğeleri ya düz string
// yapraklardır (işlevsiz yer tutucu) ya da kendi altSecenekler'i olan iç içe
// gruplardır ya da bir `gorunum` kimliği taşıyan işlevsel yapraklardır. gorunum
// taşıyan yaprak tıklanınca içerik alanında ilgili görünümü açar.
const YONETIM_SECENEKLERI = [
  {
    baslik: 'Kullanıcı Yönetimi',
    altSecenekler: [
      {
        baslik: 'Kullanıcı Listeleri',
        altSecenekler: [
          { baslik: 'Kullanıcı Listesi', gorunum: 'kullanici-listesi' },
        ],
      },
      { baslik: 'Kullanıcı Grupları', gorunum: 'kullanici-gruplari' },
    ],
  },
  {
    baslik: 'Anketler',
    altSecenekler: [
      { baslik: 'Anket Listesi', gorunum: 'anket-listesi' },
      { baslik: 'Anket Soruları', gorunum: 'anket-sorulari' },
    ],
  },
  {
    baslik: 'Eğitim Yönetimi',
    altSecenekler: [
      'Eğitimler',
      'Etkinlikler',
      'Eğitim Kaynakları',
      'Sertifikaları',
    ],
  },
  { baslik: 'Raporlar' },
  {
    baslik: 'Ayarlar',
    altSecenekler: [
      { baslik: 'Kullanıcı Seçenek Tanımları', gorunum: 'ayarlar' },
      { baslik: 'Soru Seçenek Tanımları', gorunum: 'soru-ayarlar' },
      { baslik: 'Grup Tanımları', gorunum: 'grup-ayarlar' },
    ],
  },
]

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

// AsagiOkIcon: aşağı dönük chevron (ok) simgesini çizer. Grup başlığında,
// alt seçeneklerin açık/kapalı olduğunu ima etmek için kullanılır; açıkken
// CSS ile yukarı dönecek şekilde döndürülür.
function AsagiOkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

// AdminPaneli: sağdan kayan yönetim panelini ve arkasındaki açık perdeyi render
// eder. props: acik (bool), panelKapat() -> perdeye veya kapatma ok butonuna
// tıklanınca çağrılır; onSecenekSec(gorunum) -> bir görünüm taşıyan yaprak
// seçildiğinde çağrılır (üst bileşen içeriği değiştirir ve paneli kapatır).
function AdminPaneli({ acik, panelKapat, onSecenekSec }) {
  // Açık grupları başlığa göre tutan saf UI state'i: { [baslik]: true }.
  // İç içe gruplar bağımsız olduğundan aynı anda birden çok grup açık
  // kalabilir; kapalı gruplar bu nesnede yer almaz veya false değer taşır.
  const [acikGruplar, setAcikGruplar] = useState({})

  // grupAcikligiDegistir: yalnızca tıklanan grubun açık/kapalı durumunu
  // tersine çevirir; diğer grupları etkilemez.
  function grupAcikligiDegistir(baslik) {
    setAcikGruplar((oncekiler) => ({
      ...oncekiler,
      [baslik]: !oncekiler[baslik],
    }))
  }

  // renderSecenekListesi: verilen seçenek dizisini <li> öğeleri olarak render
  // eder. Öğe düz string ise işlevsiz yaprak buton; `gorunum` taşıyan nesne ise
  // tıklanınca ilgili görünümü seçen işlevsel yaprak; altSecenekler'i yoksa düz
  // seçenek; varsa açılıp kapanan gruptur ve alt seçenekleri için kendini
  // özyinelemeli çağırır (iki seviye iç içe grup desteği).
  function renderSecenekListesi(secenekler) {
    return secenekler.map((secenek) => {
      // Düz string yaprak: işlevsiz görsel yer tutucu buton.
      if (typeof secenek === 'string') {
        return (
          <li key={secenek}>
            <button type="button" className="admin-secenek admin-alt-secenek">
              {secenek}
            </button>
          </li>
        )
      }

      // Görünüm taşıyan işlevsel yaprak: tıklanınca üst bileşene görünüm kimliği
      // iletilir (içerik değişir, panel kapanır). Yalnızca gösterim/tetikleme;
      // veri/yetki kararı burada YOK.
      if (secenek.gorunum) {
        return (
          <li key={secenek.baslik}>
            <button
              type="button"
              className="admin-secenek admin-alt-secenek"
              onClick={() => onSecenekSec(secenek.gorunum)}
            >
              {secenek.baslik}
            </button>
          </li>
        )
      }

      // Alt seçeneği olmayan düz seçenek: tek bir yer tutucu buton.
      if (!secenek.altSecenekler) {
        return (
          <li key={secenek.baslik}>
            <button type="button" className="admin-secenek">
              {secenek.baslik}
            </button>
          </li>
        )
      }

      // Grup: başlığa tıklanınca kendi alt listesi açılır/kapanır. id'de boşluk
      // olamayacağı için başlıktaki whitespace'i tire ile değiştirip güvenli bir
      // değer üretiriz; aynı değer hem id hem aria-controls'ta kullanılır.
      const grupAcik = Boolean(acikGruplar[secenek.baslik])
      const altListeId = `admin-alt-liste-${secenek.baslik.replace(/\s+/g, '-')}`
      return (
        <li key={secenek.baslik}>
          <button
            type="button"
            className="admin-secenek admin-grup-baslik"
            onClick={() => grupAcikligiDegistir(secenek.baslik)}
            aria-expanded={grupAcik}
            aria-controls={altListeId}
          >
            <span>{secenek.baslik}</span>
            <span className={`admin-grup-ok${grupAcik ? ' acik' : ''}`}>
              <AsagiOkIcon />
            </span>
          </button>
          <ul
            id={altListeId}
            className={`admin-alt-listesi${grupAcik ? ' acik' : ''}`}
          >
            {renderSecenekListesi(secenek.altSecenekler)}
          </ul>
        </li>
      )
    })
  }

  return (
    <>
      <div
        className={`admin-overlay${acik ? ' acik' : ''}`}
        onClick={panelKapat}
        aria-hidden="true"
      />
      <aside
        className={`admin-panel${acik ? ' acik' : ''}`}
        role="dialog"
        aria-label="Yönetim paneli"
        aria-hidden={!acik}
      >
        <div className="admin-panel-baslik">
          <h2>Yönetim</h2>
          <button
            type="button"
            className="admin-kapat-buton"
            onClick={panelKapat}
            aria-label="Yönetim panelini kapat"
          >
            <SagOkIcon />
          </button>
        </div>

        <ul className="admin-secenek-listesi">
          {renderSecenekListesi(YONETIM_SECENEKLERI)}
        </ul>
      </aside>
    </>
  )
}

export default AdminPaneli
