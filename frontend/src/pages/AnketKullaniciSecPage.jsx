// Anket formunun "Kullanıcılar" kartındaki "Listeden seç" bağlantısıyla YENİ
// SEKMEDE açılan kullanıcı seçme ekranı (/anket-kullanicilari-sec). Yalnızca sunum
// sorumluluğundadır: kullanıcı listesini kullaniciApi üzerinden ister, işaretlenenleri
// toplar ve açan sekmeye postMessage ile geri gönderip kendini kapatır; iş kuralı,
// yetki veya hesaplama İÇERMEZ (yetki sunucuda). Mevcut KullaniciListesi bilinçli
// olarak DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada düzenle/durum işlemleri vardır,
// seçim modu o bileşeni karmaşıklaştırırdı (SRP). SoruSecPage ile aynı kalıp:
// yükleniyor / hata / boş durumları ele alınır, yalnızca güvenli mesaj gösterilir,
// açan sekme yoksa buton yerine bilgilendirme çıkar.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listKullanicilar } from '../api/kullaniciApi.js'
import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import {
  KULLANICI_SECIM_MESAJ_TIPI,
  acanSekmeVarMi,
  secimiAcanSekmeyeGonder,
} from '../common/secimSekmesi.js'
import '../styles/kullanici-listesi.css'
import '../styles/kullanici-ekle.css'
import '../styles/soru-sec.css'

// Tablo kolon başlıkları (bu sırayla). İlk kolon seçim kutusudur.
const SECIM_KOLON_BASLIKLARI = ['Seç', 'Sicil', 'Ad Soyad', 'E-posta']

// AnketKullaniciSecPage: kullanıcı listesini gösterir ve işaretlenenleri açan
// sekmeye aktarır.
function AnketKullaniciSecPage() {
  // İşaretli kullanıcıların sicil kodları. Aktarımda liste sırası korunur.
  const [secililer, setSecililer] = useState([])

  const {
    data: kullanicilar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['kullanicilar'],
    queryFn: listKullanicilar,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = acanSekmeVarMi()

  // secimiDegistir: bir kullanıcının işaretini açar/kapatır (işaretliyse çıkarır).
  function secimiDegistir(kullaniciKodu) {
    setSecililer((oncekiler) =>
      oncekiler.includes(kullaniciKodu)
        ? oncekiler.filter((kod) => kod !== kullaniciKodu)
        : [...oncekiler, kullaniciKodu],
    )
  }

  // secilenleriAktar: işaretli kullanıcıları açan sekmeye (anket formuna) gönderir
  // ve sekmeyi kapatır. Yalnızca formun gösterdiği alanlar taşınır.
  function secilenleriAktar() {
    const secilenKullanicilar = (kullanicilar ?? [])
      .filter((kullanici) => secililer.includes(kullanici.kullanici_kodu))
      .map((kullanici) => ({
        kullanici_kodu: kullanici.kullanici_kodu,
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        email: kullanici.email,
      }))
    secimiAcanSekmeyeGonder({
      tip: KULLANICI_SECIM_MESAJ_TIPI,
      kullanicilar: secilenKullanicilar,
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

  const kullaniciListesi = kullanicilar ?? []

  return (
    <section className="soru-sec-sayfa">
      <div className="kullanici-liste-baslik-satiri">
        <h2 className="kullanici-liste-baslik">
          Ankete Eklenecek Kullanıcıları Seçin
        </h2>
      </div>

      {kullaniciListesi.length === 0 ? (
        <p className="kullanici-liste-durum">Kayıtlı kullanıcı bulunamadı.</p>
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
              {kullaniciListesi.map((kullanici) => (
                <tr key={kullanici.kullanici_kodu}>
                  <td>
                    <input
                      type="checkbox"
                      className="soru-sec-kutu"
                      checked={secililer.includes(kullanici.kullanici_kodu)}
                      onChange={() => secimiDegistir(kullanici.kullanici_kodu)}
                      aria-label="Bu kullanıcıyı ankete ekle"
                    />
                  </td>
                  <td>{kullanici.kullanici_kodu}</td>
                  <td>
                    {`${buyukHarfeCevir(kullanici.ad)} ${buyukHarfeCevir(
                      kullanici.soyad,
                    )}`}
                  </td>
                  <td>{kullanici.email}</td>
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
            kullanıcı ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </p>
        )}
      </div>
    </section>
  )
}

export default AnketKullaniciSecPage
