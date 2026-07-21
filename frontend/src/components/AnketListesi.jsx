// Anket listesi bileşeni. Admin panelinden "Anket Listesi" seçilince anasayfa
// içerik alanında render edilir. Yalnızca sunum sorumluluğundadır: veriyi anketApi
// üzerinden ister ve tabloda gösterir; iş kuralı, yetki kontrolü veya hesaplama
// İÇERMEZ (yetki sunucuda uygulanır). Yükleniyor, hata ve boş durumları kullanıcı
// listesi üslubunda ele alınır; kullanıcıya yalnızca güvenli mesaj gösterilir.
// Tasarımı kişi (kullanıcı) listesiyle BİREBİR aynı olsun ve tek kaynaktan
// gelsin diye kullanici-listesi.css içeri alınır ve MEVCUT liste düzeni sınıfları
// (kullanici-liste, kullanici-liste-baslik-satiri, kullanici-liste-baslik-grup,
// kullanici-liste-baslik, kullanici-arama-*, kullanici-ekle-buton,
// kullanici-liste-durum) paylaşılır. Sınıflardaki "kullanici-" öneki bu paylaşım
// yüzünden burada da kullanılır; kopya CSS yazılmaz (DRY) ve kullanıcı listesi
// tasarımı hiç değişmez. "Anket Ekle" butonu üst bileşene (onAnketEkle) haber
// vererek içerik alanında anket oluşturma formunu açar; kişi listesindeki
// "Kullanıcı Ekle" ile aynı kalıptadır. Filtre kartı (AnketFiltre) GERÇEK
// filtrelemeye bağlıdır: seçilen anket tipi/durum/oluşturulma tarih aralığı bu
// bileşende state'te tutulur ve uygulanacakFiltre ile sunucuya taşınır; seçim
// değişince liste React Query üzerinden anında yeniden çekilir (süzme SUNUCUDA,
// iş kuralı/tarih hesabı UI'a KONMAZ). Arama kutusu (aramaMetni) bu işin kapsamı
// DIŞINDADIR: tasarım paritesi için durur, gerçek arama YAPMAZ. "İşlem" sütunundaki "Güncelle"
// butonu, üst bileşene (onAnketDuzenle) haber vererek içerik alanında anket
// güncelleme görünümünü açar (satır özetini taşır; form detayı backend'den kendisi
// çeker). Buton stili SoruListesi'nin İşlem butonlarıyla paylaşılır (soru-listesi.css,
// DRY); yeni CSS yazılmaz.

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { anketleriGetir } from '../api/anketApi.js'
import { tarihSaatBicimlendir } from '../common/metinBicimlendir.js'
import {
  BOS_ANKET_FILTRESI,
  uygulanacakFiltre,
} from '../common/anketFiltreAlanlari.js'
import AnketFiltre from './AnketFiltre'
import '../styles/kullanici-listesi.css'
import '../styles/soru-listesi.css'

// ArtiIcon: artı (+) simgesini çizer. Başlık satırındaki "Anket Ekle" butonunda
// kullanılır (kişi listesindeki "Kullanıcı Ekle" ile aynı görünüm).
function ArtiIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// BuyutecIcon: büyüteç (arama) simgesini çizer. Başlık yanındaki arama kutusunun
// içinde görsel ipucu olarak durur (tasarım paritesi için).
function BuyutecIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

// Tablo kolon başlıkları (bu sırayla). Kişi listesindeki tablo çerçevesiyle
// birebir aynı görünsün diye tanımlanır; "İşlem" sütunu kişi listesindeki
// "İşlemler" karşılığıdır ve satır başına "Güncelle" butonu taşır.
const ANKET_KOLON_BASLIKLARI = [
  'Anket Adı',
  'Durum',
  'Oluşturan',
  'Oluşturma Tarihi',
  'Atanan Kullanıcı Sayısı',
  'Yanıtlayan Kullanıcı Sayısı',
  'İşlem',
]

// olusturanAdiBicimlendir: anketi oluşturanın ad ve soyadını tek okunur metinde
// birleştirir. İkisi de yoksa (ör. kullanıcı silinmişse) tire ('-') döner.
// Saf gösterim formatlamasıdır.
function olusturanAdiBicimlendir(anket) {
  const tamAd = `${anket.olusturan_ad ?? ''} ${anket.olusturan_soyad ?? ''}`.trim()
  return tamAd === '' ? '-' : tamAd
}

// AnketListesi: anketleri React Query ile çeker ve durumuna göre yükleniyor /
// hata / boş / tablo gösterir. Veri kaynağı yalnızca anketApi'dir.
// props: onAnketEkle() -> "Anket Ekle" butonuna tıklanınca çağrılır (üst bileşen
// anket ekleme görünümünü açar); onAnketDuzenle(anket) -> bir satırın "Güncelle"
// butonu tıklanınca çağrılır (üst bileşen o anket için güncelleme görünümünü açar).
function AnketListesi({ onAnketEkle, onAnketDuzenle }) {
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtre, setFiltre] = useState(BOS_ANKET_FILTRESI)

  // onFiltreDegis: filtre kartındaki tek bir alanın değerini günceller (kontrollü).
  // Değişiklik queryKey'i değiştireceğinden liste anında yeniden çekilir.
  function onFiltreDegis(kimlik, deger) {
    setFiltre((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // Sunucuya gönderilecek nihai filtre; hem cache anahtarı hem istek argümanı olur.
  const uygulanan = uygulanacakFiltre(filtre)

  const {
    data: anketler,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anketler', uygulanan],
    queryFn: () => anketleriGetir(uygulanan),
    // Filtre değişince önceki listeyi ekranda tut: isPending yalnızca ilk yüklemede
    // true olur, sonraki filtrelemelerde "Yükleniyor..." sıçraması ve filtre kartının
    // unmount olması engellenir (arka planda sessizce yeniden çekilir).
    placeholderData: keepPreviousData,
  })

  if (isPending) {
    return <p className="kullanici-liste-durum">Yükleniyor...</p>
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır (ör. 403 yetki mesajı);
    // teknik detay sızmaz.
    return (
      <p className="kullanici-liste-durum kullanici-liste-hata">
        {error.message}
      </p>
    )
  }

  const anketListesi = anketler ?? []

  return (
    <section className="kullanici-liste">
      <div className="kullanici-liste-baslik-satiri">
        <div className="kullanici-liste-baslik-grup">
          <h2 className="kullanici-liste-baslik">Anket Listesi</h2>
          <div className="kullanici-arama-sarmalayici">
            <span className="kullanici-arama-ikon">
              <BuyutecIcon />
            </span>
            <input
              type="search"
              className="kullanici-arama-kutusu"
              value={aramaMetni}
              onChange={(olay) => setAramaMetni(olay.target.value)}
              placeholder="Ara: anket"
              aria-label="Anket listesinde ara"
            />
          </div>
        </div>
        {/* "Anket Ekle": kişi listesindeki "Kullanıcı Ekle" kalıbıyla üst bileşene
            haber verir ve içerik alanında anket oluşturma formunu açar. */}
        <button
          type="button"
          className="kullanici-ekle-buton"
          onClick={onAnketEkle}
        >
          <ArtiIcon />
          <span>Anket Ekle</span>
        </button>
      </div>
      {/* Başlıksız filtre kartı: arama satırının hemen altında, tablonun üstünde.
          Kontrollü bileşen: seçimi filtre propundan okur, değişikliği onFiltreDegis
          ile bildirir; süzme sunucuda yapılır (queryKey değişince yeniden çekilir). */}
      <AnketFiltre filtre={filtre} onFiltreDegis={onFiltreDegis} />
      {/* Tablo çerçevesi kişi listesiyle birebir aynı sınıflarla kurulur. Anket
          yoksa başlıklı çerçeve boş görünmesin diye tek satırlık bir boş-durum
          hücresi konur; colSpan tüm kolonları kaplar (liste-bos-hucre ile ortalanır). */}
      <div className="kullanici-tablo-sarmalayici">
        <table className="kullanici-tablo">
          <thead>
            <tr>
              {ANKET_KOLON_BASLIKLARI.map((baslik) => (
                <th key={baslik}>{baslik}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {anketListesi.length === 0 ? (
              <tr>
                <td
                  colSpan={ANKET_KOLON_BASLIKLARI.length}
                  className="kullanici-liste-durum liste-bos-hucre"
                >
                  Kayıtlı anket bulunamadı.
                </td>
              </tr>
            ) : (
              anketListesi.map((anket) => (
                <tr key={anket.anket_id}>
                  <td>{anket.ad}</td>
                  <td>{anket.durum}</td>
                  <td>{olusturanAdiBicimlendir(anket)}</td>
                  <td>{tarihSaatBicimlendir(anket.olusturma_tarihi)}</td>
                  <td>{anket.atanan_sayisi}</td>
                  <td>{anket.yanitlayan_sayisi}</td>
                  <td>
                    <div className="soru-islem-hucre">
                      {/* Güncelle: üst bileşene haber vererek bu anket için güncelleme
                          görünümünü açar (form alanları backend'den çekilir). Stil
                          SoruListesi'nin İşlem butonlarıyla paylaşılır (DRY). */}
                      <button
                        type="button"
                        className="soru-islem-buton soru-guncelle-buton"
                        onClick={() => onAnketDuzenle(anket)}
                      >
                        Güncelle
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AnketListesi
