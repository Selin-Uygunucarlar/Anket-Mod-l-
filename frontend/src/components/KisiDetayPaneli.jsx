// Kişi detay paneli bileşeni. Kullanıcı listesinde bir çalışan veya yönetici
// adına tıklanınca sağ kenardan kayarak açılan bir panel (drawer) olarak,
// başlıkta DİKEY yerleşimle önce kare bir kişi amblemi (PersonIcon), altında
// o kişinin (büyük harfli) adını ortalanmış olarak gösterir. Başlık ad-soyad'ı
// üst bileşenden gelen props'tan ANINDA gösterir; içerik ise seçilen kişinin
// sicil koduyla backend'den çekilen tüm bilgilerini etiket/değer satırları
// halinde listeler (boş/null alanlar '-' olarak). Panel açıkken arkasında üst
// barın altından başlayan beyaza yakın/hafif buzlu bir perde belirir. Kapatma
// butonu panelin SOL DIŞ kenarına taşan küçük mavi bir kutudur; perdeye veya bu
// butona tıklanınca panel kapanır. Açık/kapalı durumu ve gösterilecek kişi üst
// bileşenden props ile gelir. Yalnızca sunum sorumluluğundadır; iş kuralı/
// hesaplama içermez (veri backend'den, biçimlendirme saf gösterim yardımcıları).

import { useQuery } from '@tanstack/react-query'
import { getKullaniciDetay } from '../api/kullaniciApi.js'
import { SECENEK_KATEGORILERI } from '../common/secenekKategorileri.js'
import {
  buyukHarfeCevir,
  tarihBicimlendir,
  tarihSaatBicimlendir,
} from '../common/metinBicimlendir.js'
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

// degerVeyaTire: bir metin alanı boş/null/undefined ise tire ('-') döner,
// aksi halde değerin kendisini. Saf gösterim yardımcısıdır; iş kuralı taşımaz
// (kullanıcı kararı: tüm alanlar hep görünsün, boşlar tire).
function degerVeyaTire(deger) {
  if (deger === null || deger === undefined || deger === '') {
    return '-'
  }
  return deger
}

// bicimlendirYonetici: yöneticinin ad ve soyadını büyük harfli tek metne
// birleştirir; ikisi de yoksa tire ('-') döner. Saf gösterim biçimlendirmesidir.
function bicimlendirYonetici(detay) {
  const tamAd = `${buyukHarfeCevir(detay.yonetici_ad)} ${buyukHarfeCevir(
    detay.yonetici_soyad,
  )}`.trim()
  return tamAd || '-'
}

// hazirlaDetayAlanlari: backend'den gelen detay nesnesini, panelde gösterilecek
// { etiket, deger } satır dizisine dönüştürür. 10 kategori alanının etiketleri
// SECENEK_KATEGORILERI'nden (DRY) alınır. Tarih alanları saf sunum
// biçimlendiricileriyle çevrilir; boş metinler tire olur.
function hazirlaDetayAlanlari(detay) {
  const kategoriAlanlari = SECENEK_KATEGORILERI.map((kategori) => ({
    etiket: kategori.etiket,
    deger: degerVeyaTire(detay[kategori.kimlik]),
  }))

  return [
    { etiket: 'Sicil No', deger: degerVeyaTire(detay.kullanici_kodu) },
    { etiket: 'E-posta', deger: degerVeyaTire(detay.email) },
    { etiket: 'Kullanıcı Türü', deger: degerVeyaTire(detay.kullanici_turu) },
    { etiket: 'Durum', deger: detay.aktif ? 'Aktif' : 'Pasif' },
    {
      etiket: 'İşe Giriş Tarihi',
      deger: tarihBicimlendir(detay.ise_giris_tarihi),
    },
    { etiket: 'Yönetici', deger: bicimlendirYonetici(detay) },
    ...kategoriAlanlari,
    {
      etiket: 'Sisteme Eklenme',
      deger: tarihSaatBicimlendir(detay.olusturma_tarihi),
    },
    { etiket: 'Son Giriş', deger: tarihSaatBicimlendir(detay.son_giris_tarihi) },
  ]
}

// DetayIcerik: panelin gövde içeriğini duruma göre render eder — yükleniyor,
// hata (güvenli mesaj; teknik detay sızmaz) veya detay alanlarının etiket/değer
// listesi. props: isPending, isError, error, detay.
function DetayIcerik({ isPending, isError, error, detay }) {
  if (isPending) {
    return <p className="kisi-detay-durum">Yükleniyor...</p>
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır (404/403/401); teknik detay
    // sızmaz.
    return (
      <p className="kisi-detay-durum kisi-detay-hata">{error.message}</p>
    )
  }

  const alanlar = hazirlaDetayAlanlari(detay)
  return (
    <dl className="kisi-detay-liste">
      {alanlar.map((alan) => (
        <div className="kisi-detay-satir" key={alan.etiket}>
          <dt className="kisi-detay-etiket">{alan.etiket}</dt>
          <dd className="kisi-detay-deger">{alan.deger}</dd>
        </div>
      ))}
    </dl>
  )
}

// KisiDetayPaneli: seçili kişinin detay panelini ve arkasındaki açık perdeyi
// render eder. Başlık ad-soyad'ı props'tan anında gösterir; içerik detayını
// kişinin sicil koduyla backend'den React Query ile çeker. props: acik (bool),
// kisi ({ kullanici_kodu, ad, soyad } | null), panelKapat() -> perdeye veya sol
// dış kenardaki kapatma kutusuna tıklanınca çağrılır.
function KisiDetayPaneli({ acik, kisi, panelKapat }) {
  // Büyük harfli tam ad; kişi yoksa boş kalır (panel zaten kapalıdır).
  const buyukAdSoyad = kisi
    ? `${buyukHarfeCevir(kisi.ad)} ${buyukHarfeCevir(kisi.soyad)}`.trim()
    : ''

  // Detay yalnızca panel açıkken ve geçerli bir sicil kodu varken çekilir.
  const {
    data: detay,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['kullanici-detay', kisi?.kullanici_kodu],
    queryFn: () => getKullaniciDetay(kisi.kullanici_kodu),
    enabled: acik && Boolean(kisi?.kullanici_kodu),
  })

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
          <DetayIcerik
            isPending={isPending}
            isError={isError}
            error={error}
            detay={detay}
          />
        </div>
      </aside>
    </>
  )
}

export default KisiDetayPaneli
