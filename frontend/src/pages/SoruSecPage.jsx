// Anket formunun "Yüklemek için tıklayınız" bağlantısıyla YENİ SEKMEDE açılan soru
// seçme ekranı (/anket-sorulari-sec). Yalnızca sunum sorumluluğundadır: soru
// havuzunu soruApi üzerinden ister, işaretlenenleri toplar ve açan sekmeye
// (window.opener) postMessage ile geri gönderip kendini kapatır; iş kuralı, yetki
// veya hesaplama İÇERMEZ (yetki sunucuda). Mevcut SoruListesi bilinçli olarak
// DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada düzenle/sil işlemleri vardır, seçim modu
// o bileşeni karmaşıklaştırırdı (SRP). Yükleniyor / hata / boş durumları
// KullaniciListesi üslubuyla ele alınır; yalnızca güvenli mesaj gösterilir.
// Sekme doğrudan (açan sekme olmadan) açılmışsa seçim aktarılamayacağı için
// buton yerine bilgilendirme gösterilir.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sorulariGetir } from '../api/soruApi.js'
import { soruTipiEtiketi } from '../common/soruTipleri.js'
import '../styles/kullanici-listesi.css'
import '../styles/soru-listesi.css'
import '../styles/kullanici-ekle.css'
import '../styles/soru-sec.css'

// Açan sekmeye gönderilen mesajın tipi. Anket formu dinleyicisi mesajları bu
// etikete göre ayırt eder (origin doğrulaması ayrıca yapılır).
const SECIM_MESAJ_TIPI = 'anket-sorulari-secildi'

// Tablo kolon başlıkları (bu sırayla). İlk kolon seçim kutusudur.
const SECIM_KOLON_BASLIKLARI = ['Seç', 'Soru Metni', 'Soru Tipi']

// SoruSecPage: soru havuzunu listeler ve işaretlenen soruları açan sekmeye aktarır.
function SoruSecPage() {
  // İşaretli soru kimlikleri. Sıra, kullanıcının işaretleme sırası değil listedeki
  // görünüm sırasıdır (aktarımda liste sırası korunur).
  const [secililer, setSecililer] = useState([])

  const {
    data: sorular,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['sorular'],
    queryFn: sorulariGetir,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = Boolean(window.opener) && !window.opener.closed

  // secimiDegistir: bir sorunun işaretini açar/kapatır (işaretliyse çıkarır).
  function secimiDegistir(soruId) {
    setSecililer((oncekiler) =>
      oncekiler.includes(soruId)
        ? oncekiler.filter((kimlik) => kimlik !== soruId)
        : [...oncekiler, soruId],
    )
  }

  // secilenleriAktar: işaretli soruları açan sekmeye (anket formuna) gönderir ve
  // sekmeyi kapatır. Hedef origin KENDİ ORIGIN'imizdir ('*' değil): mesaj yalnızca
  // aynı origin'deki sayfaya teslim edilir, başka sitelere sızmaz.
  function secilenleriAktar() {
    const secilenSorular = (sorular ?? [])
      .filter((soru) => secililer.includes(soru.soru_id))
      .map((soru) => ({
        soru_id: soru.soru_id,
        soru_metni: soru.soru_metni,
        soru_tipi: soru.soru_tipi,
      }))
    window.opener.postMessage(
      { tip: SECIM_MESAJ_TIPI, sorular: secilenSorular },
      window.location.origin,
    )
    window.close()
  }

  if (isPending) {
    return (
      <section className="soru-sec-sayfa">
        <p className="kullanici-liste-durum">Yükleniyor...</p>
      </section>
    )
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır; teknik detay sızmaz.
    return (
      <section className="soru-sec-sayfa">
        <p className="kullanici-liste-durum kullanici-liste-hata" role="alert">
          {error.message}
        </p>
      </section>
    )
  }

  const soruListesi = sorular ?? []

  return (
    <section className="soru-sec-sayfa">
      <div className="kullanici-liste-baslik-satiri">
        <h2 className="kullanici-liste-baslik">Ankete Eklenecek Soruları Seçin</h2>
      </div>

      {soruListesi.length === 0 ? (
        <p className="kullanici-liste-durum">Kayıtlı soru bulunamadı.</p>
      ) : (
        <div className="kullanici-tablo-sarmalayici">
          <table className="kullanici-tablo">
            <thead>
              <tr>
                {SECIM_KOLON_BASLIKLARI.map((baslik) => (
                  <th key={baslik}>{baslik}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {soruListesi.map((soru) => (
                <tr key={soru.soru_id}>
                  <td>
                    <input
                      type="checkbox"
                      className="soru-sec-kutu"
                      checked={secililer.includes(soru.soru_id)}
                      onChange={() => secimiDegistir(soru.soru_id)}
                      aria-label="Bu soruyu ankete ekle"
                    />
                  </td>
                  <td>
                    {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir; UI yeniden
                        sanitize etmez/işlemez (SoruListesi ile aynı kalıp). */}
                    <div
                      className="soru-metni-icerik"
                      dangerouslySetInnerHTML={{ __html: soru.soru_metni }}
                    />
                  </td>
                  <td>{soruTipiEtiketi(soru.soru_tipi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="soru-sec-alt-cubuk">
        {acanSekmeVar ? (
          <button
            type="button"
            className="birincil-buton"
            disabled={secililer.length === 0}
            onClick={secilenleriAktar}
          >
            Seçilenleri Ekle
          </button>
        ) : (
          <p className="kullanici-liste-durum">
            Bu ekran, anket formundaki "Yüklemek için tıklayınız" bağlantısıyla
            açıldığında soru ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </p>
        )}
      </div>
    </section>
  )
}

export default SoruSecPage
