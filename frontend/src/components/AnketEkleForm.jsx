// Anket oluşturma/güncelleme formu. Anket listesindeki "Anket Ekle" butonuyla
// anasayfa içerik alanında render edilir. ŞİMDİLİK yalnızca UI iskeletidir:
// backend/API/servis/repository yoktur; girdiler saf UI state'inde toplanır ve
// Kaydet butonu gerçek bir kayıt YAPMAZ (yanıltıcı "başarı" gösterilmez).
// Yalnızca sunum sorumluluğundadır: alanları gösterir ve girdi toplar; iş kuralı,
// yetki veya hesaplama İÇERMEZ. Zorunlu alanların (Adı, Anket Tipi) boş olup
// olmadığı yalnızca UX için (Kaydet butonunu pasifleştirmek) kontrol edilir; asıl
// doğrulama ileride sunucuda yapılacaktır. Kişi formundaki gibi tek modda
// kullanıldığından ortak gövde bileşenine BÖLÜNMEZ (over-engineering yasağı).
// Görünüm sınıfları kullanici-ekle.css ile paylaşılır (DRY); radyo grupları ve
// alt başlık için gereken minimum ek stil anket-ekle.css'ten gelir.

import { useState } from 'react'
import AnketKart from './AnketKart'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// Anket tipi seçenekleri (bu sırayla). Zorunlu radyo grubudur; varsayılan seçili
// yoktur. Tek yerde tanımlanıp render'da .map ile üretilir (DRY).
const ANKET_TIPI_SECENEKLERI = [
  'Kullanıcı Bilgi Anketi',
  'Etkinlik Değerlendirme Anketi',
  'Eğitim Değerlendirme Anketi',
  'Etkinlik Davranış Anketi',
  'Eğitim Davranış Anketi',
]

// Durum radyo grubu seçenekleri. Görünen metin ile state'te tutulan değer
// aynıdır; varsayılan olarak "Aktif" seçilidir.
const DURUM_SECENEKLERI = ['Aktif', 'Pasif']

// Erişim seviyesi dropdown seçenekleri (bu sırayla). İlk seçenek placeholder
// "Seçiniz"dir (boş değer) ve bu dizide yer almaz.
const ERISIM_SEVIYESI_SECENEKLERI = [
  'Çalışma grubumdakiler ve ben görebilir ve yönetebiliriz',
  'Sadece ben görebilir ve yönetebilirim',
  'Herkes görebilir ve yönetebilir',
]

// Formun başlangıç değerleri: metin alanları boş, Durum "Aktif", Anket Tipi ve
// Erişim Seviyesi seçilmemiş (boş).
const BOS_ANKET_FORMU = {
  adi: '',
  on_yazi: '',
  son_yazi: '',
  aciklama: '',
  durum: 'Aktif',
  anket_tipi: '',
  erisim_seviyesi: '',
}

// AnketEkleForm: anket oluşturma/güncelleme alanlarını gösterir ve girdi toplar.
// props: onGeriDon() -> "Geri Dön" tıklanınca çağrılır (üst bileşen listeye döner).
function AnketEkleForm({ onGeriDon }) {
  const [form, setForm] = useState(BOS_ANKET_FORMU)

  // alanGuncelle: tek bir form alanının değerini günceller (kontrollü girdiler).
  function alanGuncelle(kimlik, deger) {
    setForm((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // Kaydet yalnızca zorunlu alanlar (Adı ve Anket Tipi) dolunca aktif olur; bu
  // sadece UX içindir, güvenlik/doğrulama sınırı değildir.
  const kaydetPasif = form.adi.trim() === '' || form.anket_tipi === ''

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">Anket Oluşturma - Güncelleme</h2>

      {/* Backend olmadığından form gönderimi yoktur; alanlar saf UI state'inde
          toplanır. Kaydet butonu type="button" ve işlevsizdir. */}
      <form className="kullanici-ekle-form" noValidate>
        <AnketKart baslik="Anket Bilgileri">
        <div className="kullanici-ekle-izgara">
          <label className="form-satir">
            <span className="form-etiket">
              Adı <span className="zorunlu-yildiz">*</span>
            </span>
            <input
              className="form-kutu"
              type="text"
              value={form.adi}
              onChange={(olay) => alanGuncelle('adi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Ön Yazı</span>
            <input
              className="form-kutu"
              type="text"
              value={form.on_yazi}
              onChange={(olay) => alanGuncelle('on_yazi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Son Yazı</span>
            <input
              className="form-kutu"
              type="text"
              value={form.son_yazi}
              onChange={(olay) => alanGuncelle('son_yazi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Açıklama</span>
            <input
              className="form-kutu"
              type="text"
              value={form.aciklama}
              onChange={(olay) => alanGuncelle('aciklama', olay.target.value)}
            />
          </label>

          {/* Durum: radyo grubu; label sarmalayıcısı olmadan bir satır, seçenekler
              sağda daire olarak. Grup adı "anket-durum". */}
          <div className="form-satir">
            <span className="form-etiket">Durum</span>
            <div className="anket-radyo-grup">
              {DURUM_SECENEKLERI.map((secenek) => (
                <label key={secenek} className="anket-radyo-secenek">
                  <input
                    type="radio"
                    name="anket-durum"
                    value={secenek}
                    checked={form.durum === secenek}
                    onChange={() => alanGuncelle('durum', secenek)}
                  />
                  <span>{secenek}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Anket Tipi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
              "anket-tipi". */}
          <div className="form-satir">
            <span className="form-etiket">
              Anket Tipi <span className="zorunlu-yildiz">*</span>
            </span>
            <div className="anket-radyo-grup anket-radyo-grup--tip">
              {ANKET_TIPI_SECENEKLERI.map((secenek) => (
                <label key={secenek} className="anket-radyo-secenek">
                  <input
                    type="radio"
                    name="anket-tipi"
                    value={secenek}
                    checked={form.anket_tipi === secenek}
                    onChange={() => alanGuncelle('anket_tipi', secenek)}
                  />
                  <span>{secenek}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="form-satir">
            <span className="form-etiket">Erişim Seviyesi</span>
            <select
              className="form-kutu"
              value={form.erisim_seviyesi}
              onChange={(olay) =>
                alanGuncelle('erisim_seviyesi', olay.target.value)
              }
            >
              <option value="">Seçiniz</option>
              {ERISIM_SEVIYESI_SECENEKLERI.map((secenek) => (
                <option key={secenek} value={secenek}>
                  {secenek}
                </option>
              ))}
            </select>
          </label>
        </div>
        </AnketKart>

        {/* Sorular kartı: başlık zorunlu (kırmızı yıldız). İçerik ŞİMDİLİK yalnızca
            görsel iskelettir: "Excel ile yükle" ve "Yüklemek için tıklayınız"
            öğeleri İŞLEVSİZDİR (onClick yok), dosya seçici bile açmaz. Soru listesi
            state'i / iş kuralı yoktur; salt gösterim. */}
        <AnketKart
          baslik={
            <>
              Sorular <span className="zorunlu-yildiz">*</span>
            </>
          }
        >
          {/* Excel ile yükle: bağlantı görünümlü, tamamen görsel; tıklama hiçbir
              şey yapmaz. */}
          <div className="anket-sorular-arac-cubugu">
            <button type="button" className="baglanti-buton">
              Excel ile yükle
            </button>
          </div>

          {/* Boş durum: henüz soru yok. Bağlantı görünümlü buton işlevsizdir. */}
          <p className="anket-bos-durum">
            Soru bulunmamaktadır.{' '}
            <button type="button" className="baglanti-buton">
              Yüklemek için tıklayınız
            </button>
          </p>
        </AnketKart>

        <div className="kullanici-ekle-butonlar">
          {/* Kaydet ŞİMDİLİK İŞLEVSİZ: backend/API henüz yok. Zorunlu alanlar
              dolmadıkça pasiftir (yalnızca UX). Aktif olduğunda da kayıt/gönderim
              YAPMAZ; gerçek kayıt akışı ileride API'ye bağlanacaktır. */}
          <span
            className="kaydet-sarmalayici"
            data-uyari={
              kaydetPasif ? 'Lütfen zorunlu alanları doldurun' : undefined
            }
          >
            <button
              type="button"
              className="birincil-buton"
              disabled={kaydetPasif}
            >
              Kaydet
            </button>
          </span>
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </form>
    </section>
  )
}

export default AnketEkleForm
