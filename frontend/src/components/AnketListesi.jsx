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
// "Atanan Kullanıcı Sayısı" ve "Yanıtlayan Kullanıcı Sayısı" hücreleri sayı 0'dan
// büyükken tıklanabilir birer butondur: ilki ankete atanmış herkesi, ikincisi
// yalnızca yanıtlayanları AnketAtamaKutusu'nda gösterir; oradaki "Cevapları Gör"
// ile kişinin cevapları AnketKullaniciCevaplariKutusu'nda AÇILAN kutunun ÜSTÜNDE
// açılır. Hangi kutunun kimin için açık olduğu burada saf UI state'te tutulur;
// veri çekme ve gösterim ilgili kutu bileşenlerine aittir (SRP).

import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { anketleriGetir } from '../api/anketApi.js'
import { adSoyadBirlestir, tarihSaatBicimlendir } from '../common/metinBicimlendir.js'
import {
  BOS_ANKET_FILTRESI,
  uygulanacakFiltre,
} from '../common/anketFiltreAlanlari.js'
import AnketFiltre from './AnketFiltre'
import AnketAtamaKutusu from './AnketAtamaKutusu'
import AnketKullaniciCevaplariKutusu from './AnketKullaniciCevaplariKutusu'
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
// birleştirir (ortak biçimlendirici üzerinden; ikisi de yoksa tire döner).
function olusturanAdiBicimlendir(anket) {
  return adSoyadBirlestir(anket.olusturan_ad, anket.olusturan_soyad)
}

// SayiHucresi: atanan/yanıtlayan sayısını gösterir. Sayı 0'dan büyükken ilgili
// kişi listesini açan gerçek bir <button> (klavyeyle erişilebilir), 0 iken düz
// metindir (açılacak liste yoktur). Gösterme/gizleme salt UX'tir; yetki sunucuda.
// props: sayi -> gösterilecek adet; ariaEtiketi -> butonun okunur açıklaması;
// onAc() -> butona basılınca ilgili kutuyu açar.
function SayiHucresi({ sayi, ariaEtiketi, onAc }) {
  const deger = sayi ?? 0
  if (deger <= 0) {
    return <span>{deger}</span>
  }
  return (
    <button
      type="button"
      className="kisi-ad-buton"
      onClick={onAc}
      aria-label={ariaEtiketi}
    >
      {deger}
    </button>
  )
}

// AnketListesi: anketleri React Query ile çeker ve durumuna göre yükleniyor /
// hata / boş / tablo gösterir. Veri kaynağı yalnızca anketApi'dir.
// props: onAnketEkle() -> "Anket Ekle" butonuna tıklanınca çağrılır (üst bileşen
// anket ekleme görünümünü açar); onAnketDuzenle(anket) -> bir satırın "Güncelle"
// butonu tıklanınca çağrılır (üst bileşen o anket için güncelleme görünümünü açar).
function AnketListesi({ onAnketEkle, onAnketDuzenle }) {
  const [aramaMetni, setAramaMetni] = useState('')
  const [filtre, setFiltre] = useState(BOS_ANKET_FILTRESI)
  // Açık kişi listesi kutusu: null = kapalı; { anket, mod } = ilgili anketin
  // atananları ('atanan') ya da yanıtlayanları ('yanitlayan').
  const [atamaKutusu, setAtamaKutusu] = useState(null)
  // Açık cevap kutusu: null = kapalı; { anket, kullanici } = o kişinin cevapları.
  // Kişi listesi kutusu açık kalır; cevap kutusu kapanınca listeye geri dönülür.
  const [cevapKutusu, setCevapKutusu] = useState(null)

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
                  <td>
                    <SayiHucresi
                      sayi={anket.atanan_sayisi}
                      ariaEtiketi={`${anket.ad} anketine atanan kullanıcıları göster`}
                      onAc={() => setAtamaKutusu({ anket, mod: 'atanan' })}
                    />
                  </td>
                  <td>
                    <SayiHucresi
                      sayi={anket.yanitlayan_sayisi}
                      ariaEtiketi={`${anket.ad} anketini yanıtlayan kullanıcıları göster`}
                      onAc={() => setAtamaKutusu({ anket, mod: 'yanitlayan' })}
                    />
                  </td>
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
      {/* Kişi listesi kutusu: hangi anket ve hangi mod için açıldığı state'te
          tutulur. Cevap kutusu açıkken bu kutu açık KALIR (kullanıcı listeyi
          kaybetmesin) ama kapatma en üstteki kutuya aittir. */}
      {atamaKutusu && (
        <AnketAtamaKutusu
          anket={atamaKutusu.anket}
          mod={atamaKutusu.mod}
          ustKutuAcik={cevapKutusu !== null}
          onKapat={() => setAtamaKutusu(null)}
          onCevaplariGor={(kullanici) =>
            setCevapKutusu({ anket: atamaKutusu.anket, kullanici })
          }
        />
      )}
      {/* Cevap kutusu listenin ÜSTÜNDE açılır; kapanınca kişi listesine dönülür. */}
      {cevapKutusu && (
        <AnketKullaniciCevaplariKutusu
          anket={cevapKutusu.anket}
          kullanici={cevapKutusu.kullanici}
          onKapat={() => setCevapKutusu(null)}
        />
      )}
    </section>
  )
}

export default AnketListesi
