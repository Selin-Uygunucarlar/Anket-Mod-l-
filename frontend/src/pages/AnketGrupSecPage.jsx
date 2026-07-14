// Anket formunun "Kullanıcılar" kartındaki "Kullanıcı Grupları" satırının
// "Listeden seç" bağlantısıyla YENİ SEKMEDE açılan grup seçme ekranı
// (/anket-gruplari-sec). Yalnızca sunum sorumluluğundadır: grup listesini grupApi
// üzerinden ister, işaretlenenleri toplar ve açan sekmeye postMessage ile geri
// gönderip kendini kapatır; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki
// sunucuda). Mevcut grup yönetim ekranı DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada
// ekleme/silme/üye atama vardır, seçim modu onu karmaşıklaştırırdı (SRP).
// SoruSecPage ile aynı kalıp: yükleniyor / hata / boş durumları ele alınır,
// yalnızca güvenli mesaj gösterilir, açan sekme yoksa buton yerine bilgilendirme.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listGruplar } from '../api/grupApi.js'
import {
  GRUP_SECIM_MESAJ_TIPI,
  acanSekmeVarMi,
  secimiAcanSekmeyeGonder,
} from '../common/secimSekmesi.js'
import '../styles/kullanici-listesi.css'
import '../styles/kullanici-ekle.css'
import '../styles/soru-sec.css'

// Tablo kolon başlıkları (bu sırayla). İlk kolon seçim kutusudur.
const SECIM_KOLON_BASLIKLARI = ['Seç', 'Grup Adı', 'Üye Sayısı']

// AnketGrupSecPage: kullanıcı gruplarını listeler ve işaretlenenleri açan sekmeye
// aktarır.
function AnketGrupSecPage() {
  // İşaretli grup kimlikleri. Aktarımda liste sırası korunur.
  const [secililer, setSecililer] = useState([])

  const {
    data: gruplar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['gruplar'],
    queryFn: listGruplar,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = acanSekmeVarMi()

  // secimiDegistir: bir grubun işaretini açar/kapatır (işaretliyse çıkarır).
  function secimiDegistir(grupId) {
    setSecililer((oncekiler) =>
      oncekiler.includes(grupId)
        ? oncekiler.filter((kimlik) => kimlik !== grupId)
        : [...oncekiler, grupId],
    )
  }

  // secilenleriAktar: işaretli grupları açan sekmeye (anket formuna) gönderir ve
  // sekmeyi kapatır. Yalnızca formun gösterdiği alanlar taşınır.
  function secilenleriAktar() {
    const secilenGruplar = (gruplar ?? [])
      .filter((grup) => secililer.includes(grup.grup_id))
      .map((grup) => ({
        grup_id: grup.grup_id,
        ad: grup.ad,
        uye_sayisi: grup.uye_sayisi,
      }))
    secimiAcanSekmeyeGonder({
      tip: GRUP_SECIM_MESAJ_TIPI,
      gruplar: secilenGruplar,
    })
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

  const grupListesi = gruplar ?? []

  return (
    <section className="soru-sec-sayfa">
      <div className="kullanici-liste-baslik-satiri">
        <h2 className="kullanici-liste-baslik">
          Ankete Eklenecek Kullanıcı Gruplarını Seçin
        </h2>
      </div>

      {grupListesi.length === 0 ? (
        <p className="kullanici-liste-durum">Kayıtlı grup bulunamadı.</p>
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
              {grupListesi.map((grup) => (
                <tr key={grup.grup_id}>
                  <td>
                    <input
                      type="checkbox"
                      className="soru-sec-kutu"
                      checked={secililer.includes(grup.grup_id)}
                      onChange={() => secimiDegistir(grup.grup_id)}
                      aria-label="Bu grubu ankete ekle"
                    />
                  </td>
                  <td>{grup.ad}</td>
                  <td>{grup.uye_sayisi}</td>
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
            Bu ekran, anket formundaki "Listeden seç" bağlantısıyla açıldığında
            grup ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </p>
        )}
      </div>
    </section>
  )
}

export default AnketGrupSecPage
