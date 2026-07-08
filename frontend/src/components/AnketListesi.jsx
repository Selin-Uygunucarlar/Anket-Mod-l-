// Anket listesi bileşeni. Admin panelinden "Anket Listesi" seçilince anasayfa
// içerik alanında render edilir. ŞİMDİLİK yalnızca UI iskeletidir: gerçek anket
// verisi, API/servis/repository yoktur; yalnızca gösterim sorumluluğundadır.
// Tasarımı kişi (kullanıcı) listesiyle BİREBİR aynı olsun ve tek kaynaktan
// gelsin diye kullanici-listesi.css içeri alınır ve MEVCUT liste düzeni sınıfları
// (kullanici-liste, kullanici-liste-baslik-satiri, kullanici-liste-baslik-grup,
// kullanici-liste-baslik, kullanici-arama-*, kullanici-ekle-buton,
// kullanici-liste-durum) paylaşılır. Sınıflardaki "kullanici-" öneki bu paylaşım
// yüzünden burada da kullanılır; kopya CSS yazılmaz (DRY) ve kullanıcı listesi
// tasarımı hiç değişmez. Kişi listesindeki tablo çerçevesi (kolon başlıklarıyla
// dolu) burada da görünsün diye aynı tablo yapısı (kullanici-tablo-sarmalayici >
// kullanici-tablo > thead) kullanılır; ancak gerçek veri olmadığından gövdede
// satır yerine TEK bir boş-durum satırı ("Kayıtlı anket bulunamadı.") gösterilir.
// "Anket Ekle" butonu üst bileşene (onAnketEkle) haber vererek içerik alanında
// anket oluşturma formunu açar; kişi listesindeki "Kullanıcı Ekle" ile aynı
// kalıptadır. Formun kaydı ise backend adımında bağlanacaktır.
// Arama satırının hemen altında, tablonun üstünde BAŞLIKSIZ bir filtre kartı
// (AnketFiltre) render edilir; o da salt sunumdur (gerçek filtreleme/API yoktur).

import { useState } from 'react'
import AnketFiltre from './AnketFiltre'
import '../styles/kullanici-listesi.css'

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
// "İşlemler" karşılığıdır ve ileride satır işlem menüsü (Güncelle + Pasif yap)
// taşıyacaktır. Şimdilik veri/satır olmadığından yalnızca başlık olarak durur.
const ANKET_KOLON_BASLIKLARI = [
  'Anket Adı',
  'Durum',
  'Oluşturan',
  'Oluşturma Tarihi',
  'Atanan Kullanıcı Sayısı',
  'Yanıtlayan Kullanıcı Sayısı',
  'İşlem',
]

// AnketListesi: kişi listesiyle aynı başlık satırını (başlık + arama kutusu +
// "Anket Ekle") ve aynı tablo çerçevesini (kolon başlıklarıyla) kurar. Saf
// sunumdur; iş kuralı/veri çekimi içermez. Arama kutusu tasarım paritesi için
// durur; süzülecek veri olmadığından state yalnızca metni tutar, işlev görseldir.
// props: onAnketEkle() -> "Anket Ekle" butonuna tıklanınca çağrılır (üst bileşen
// anket ekleme görünümünü açar).
function AnketListesi({ onAnketEkle }) {
  const [aramaMetni, setAramaMetni] = useState('')

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
            haber verir ve içerik alanında anket oluşturma formunu açar. Formun
            kaydı backend adımında bağlanacaktır. */}
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
          Salt sunumdur; kendi state'ini tutar, gerçek filtreleme/API yoktur. */}
      <AnketFiltre />
      {/* Tablo çerçevesi kişi listesiyle birebir aynı sınıflarla kurulur. Gerçek
          veri kaynağı olmadığından gövdeye satır basılmaz; başlıklı çerçeve boş
          görünmesin diye tek satırlık bir boş-durum hücresi konur. colSpan tüm
          kolonları kaplar (liste-bos-hucre ile ortalanır). */}
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
            <tr>
              <td
                colSpan={ANKET_KOLON_BASLIKLARI.length}
                className="kullanici-liste-durum liste-bos-hucre"
              >
                Kayıtlı anket bulunamadı.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AnketListesi
