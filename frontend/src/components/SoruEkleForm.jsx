// Anket sorusu ekleme formu. Anket soruları listesindeki "Yeni Soru Ekle"
// butonuyla anasayfa içerik alanında render edilir. Salt sunum sorumluluğundadır:
// alanları gösterir ve girdi toplar; iş kuralı, yetki veya hesaplama İÇERMEZ.
// Alanlar (her biri kendi UI state'inde): Soru Tipi (sabit liste), Seçenek Sayısı
// (2-15), Konu* ve Amaç* (yönetilen seçeneklerden gelir; ['secenekler'] sorgusuyla
// çekilip kategoriye göre gruplanır). Izgaranın altında Soru Metni* (tek zengin
// metin kartı) ve Seçenekler* (Seçenek Sayısı kadar zengin metin kartı) bulunur;
// bunların içeriği HTML olarak UI state'inde toplanır (SoruMetniKart kullanılır).
// Zorunlu alanlar ZORUNLU işaretlidir (yalnızca görsel; asıl doğrulama sunucuda).
// KAYIT bu turda YOKTUR: Kaydet butonu eklenmez, gerçek gönderim/backend akışı
// sonraki adıma bırakılır (yanıltıcı başarı gösterilmez). Görünüm sınıfları
// kullanici-ekle.css ile paylaşılır (DRY); yalnızca küçük yerleşim sınıfları eklenir.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import { gruplaSeceneklerKategoriyeGore } from '../common/secenekKategorileri.js'
import { SORU_TIPLERI } from '../common/soruTipleri.js'
import SoruMetniKart from './SoruMetniKart.jsx'
import '../styles/kullanici-ekle.css'

// Seçenek Sayısı dropdown'ının değerleri: 2'den 15'e kadar. Tek yerde kullanıldığı
// için ayrı bir common dosyası yerine burada üretilir.
const SECENEK_SAYISI_SECENEKLERI = Array.from({ length: 14 }, (_, sira) => sira + 2)

// SoruEkleForm: anket sorusu ekleme alanlarını gösterir ve girdi toplar.
// props: onGeriDon() -> "Geri Dön" tıklanınca çağrılır (üst bileşen listeye döner).
function SoruEkleForm({ onGeriDon }) {
  const [soruTipi, setSoruTipi] = useState('')
  const [secenekSayisi, setSecenekSayisi] = useState('')
  const [konu, setKonu] = useState('')
  const [amac, setAmac] = useState('')
  // Soru metni ve her bir seçeneğin metni HTML string olarak tutulur (SoruMetniKart
  // biçimlendirilmiş içerik üretir). Seçenekler dizisi, seçili Seçenek Sayısı kadar
  // eleman içerir; senkronizasyonu aşağıdaki useEffect yapar.
  const [soruMetni, setSoruMetni] = useState('')
  const [secenekMetinleri, setSecenekMetinleri] = useState([])

  // Seçenek Sayısı değiştikçe seçenek metni dizisini o uzunluğa getirir; hâlihazırda
  // yazılmış içerikleri korur (kısalırken baştakiler kalır, uzarken '' eklenir).
  // Uzunluk zaten eşitse aynı diziyi döndürerek gereksiz render/imleç sıçramasını önler.
  useEffect(() => {
    const secilenSayi = Number.parseInt(secenekSayisi, 10)
    const hedefUzunluk = Number.isNaN(secilenSayi) ? 0 : secilenSayi
    setSecenekMetinleri((oncekiler) => {
      if (oncekiler.length === hedefUzunluk) return oncekiler
      const yeniDizi = oncekiler.slice(0, hedefUzunluk)
      while (yeniDizi.length < hedefUzunluk) {
        yeniDizi.push('')
      }
      return yeniDizi
    })
  }, [secenekSayisi])

  // guncelleSecenekMetni: belirtilen indeksteki seçeneğin HTML içeriğini günceller;
  // diziyi kopyalayıp yalnızca o indeksi değiştirir, diğer seçenekleri korur.
  function guncelleSecenekMetni(indeks, yeniHtml) {
    setSecenekMetinleri((oncekiler) => {
      const yeniDizi = oncekiler.slice()
      yeniDizi[indeks] = yeniHtml
      return yeniDizi
    })
  }

  // Yönetilen seçenekleri çeker; hata/yükleme durumunda dropdown'lar yalnızca
  // placeholder gösterir (teknik detay sızdırılmaz, KullaniciEkleForm kalıbı).
  const { data: secenekler } = useQuery({
    queryKey: ['secenekler'],
    queryFn: listSecenekler,
  })

  const gruplandirilmis = gruplaSeceneklerKategoriyeGore(secenekler)
  const konuSecenekleri = gruplandirilmis['konu'] ?? []
  const amacSecenekleri = gruplandirilmis['amac'] ?? []

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">Anket Sorusu Ekleme</h2>

      {/* Backend olmadığından form gönderimi yoktur; alanlar saf UI state'inde
          toplanır. Kaydet butonu bilinçli olarak YOKTUR (kayıt ucu sonraki adımda). */}
      <form className="kullanici-ekle-form" noValidate>
        <div className="kullanici-ekle-izgara">
          <label className="form-satir">
            <span className="form-etiket">Soru Tipi</span>
            <select
              className="form-kutu"
              value={soruTipi}
              onChange={(olay) => setSoruTipi(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {SORU_TIPLERI.map((secenek) => (
                <option key={secenek.kimlik} value={secenek.kimlik}>
                  {secenek.etiket}
                </option>
              ))}
            </select>
          </label>

          <label className="form-satir">
            <span className="form-etiket">Seçenek Sayısı</span>
            <select
              className="form-kutu"
              value={secenekSayisi}
              onChange={(olay) => setSecenekSayisi(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {SECENEK_SAYISI_SECENEKLERI.map((sayi) => (
                <option key={sayi} value={sayi}>
                  {sayi}
                </option>
              ))}
            </select>
          </label>

          <label className="form-satir">
            <span className="form-etiket">
              Konu <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={konu}
              onChange={(olay) => setKonu(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {konuSecenekleri.map((deger) => (
                <option key={deger} value={deger}>
                  {deger}
                </option>
              ))}
            </select>
          </label>

          <label className="form-satir">
            <span className="form-etiket">
              Amaç <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={amac}
              onChange={(olay) => setAmac(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {amacSecenekleri.map((deger) => (
                <option key={deger} value={deger}>
                  {deger}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Soru Metni: dış form-etiketiyle zorunlu işaretlenir; kart kendi başlığını
            göstermez (çift başlık olmaması için baslik verilmez). İçerik HTML. */}
        <div className="soru-ekle-metin-alani">
          <span className="form-etiket">
            Soru Metni <span className="zorunlu-yildiz">*</span>
          </span>
          <SoruMetniKart
            deger={soruMetni}
            onDegisim={setSoruMetni}
            placeholder="Soru metnini yazın"
          />
        </div>

        {/* Seçenekler: dikey bir bölüm. En üstte tek satır "Seçenekler *" başlığı,
            altında Seçenek Sayısı kadar seçenek satırı alt alta dizilir. Her satırın
            "Seçenek N" etiketi, üstteki dropdown'ların etiketleriyle aynı 180px sol
            sütunda başlar. Sayı seçilmediyse (dizi boş) kart yerine yönlendirme ipucu
            gösterilir. */}
        <div className="soru-ekle-secenekler-blok">
          <span className="form-etiket">
            Seçenekler <span className="zorunlu-yildiz">*</span>
          </span>
          {secenekMetinleri.length === 0 ? (
            <p className="kullanici-ekle-uyari">Önce Seçenek Sayısı seçiniz</p>
          ) : (
            secenekMetinleri.map((secenekMetni, indeks) => (
              // Her seçenek satırı: solda 180px "Seçenek N" etiketi, sağda metin
              // kartı; etiket kartla dikey ortada hizalanır (yerleşim CSS'te). Kart
              // kendi başlığını göstermez (baslik verilmez).
              <div className="soru-ekle-secenek-satiri" key={indeks}>
                <span className="form-etiket soru-ekle-secenek-etiket">
                  Seçenek {indeks + 1}
                </span>
                <SoruMetniKart
                  deger={secenekMetni ?? ''}
                  onDegisim={(yeniHtml) => guncelleSecenekMetni(indeks, yeniHtml)}
                  placeholder={`Seçenek ${indeks + 1} metnini yazın`}
                />
              </div>
            ))
          )}
        </div>

        <div className="kullanici-ekle-butonlar">
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </form>
    </section>
  )
}

export default SoruEkleForm
