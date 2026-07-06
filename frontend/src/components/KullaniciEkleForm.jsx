// Kullanıcı ekleme formu bileşeni. Admin panelinden "Kullanıcı Ekle" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// girdi toplar, dropdown seçeneklerini secenekApi'den ister ve kaydı createKullanici
// üzerinden backend'e iletir; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki ve
// asıl doğrulama sunucuda). Zorunlu alanların boş olup olmadığı yalnızca UX için
// (Kaydet butonunu pasifleştirmek) kontrol edilir. Başarıda üretilen geçici şifre
// bir kez gösterilir; localStorage'a/loga YAZILMAZ. Hata durumunda yalnızca
// backend'in güvenli mesajı gösterilir (teknik detay sızmaz).

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import { createKullanici } from '../api/kullaniciApi.js'
import {
  SECENEK_KATEGORILERI,
  gruplaSeceneklerKategoriyeGore,
} from '../common/secenekKategorileri.js'
import '../styles/kullanici-ekle.css'

// Zorunlu metin alanları (gösterim sırasıyla). Zorunluluk yalnızca UX içindir;
// asıl doğrulama sunucudadır.
const ZORUNLU_METIN_ALANLARI = [
  { kimlik: 'kullanici_kodu', etiket: 'Kullanıcı Kodu' },
  { kimlik: 'ad', etiket: 'Ad' },
  { kimlik: 'soyad', etiket: 'Soyad' },
  { kimlik: 'email', etiket: 'E-posta', tip: 'email' },
]

// Formun tüm alanları için boş başlangıç durumu. Tüm dropdown ve opsiyonel
// alanlar boş string ile başlar (backend boş opsiyonelleri normalize eder).
const BOS_FORM = {
  kullanici_kodu: '',
  ad: '',
  soyad: '',
  email: '',
  kullanici_turu: '',
  ise_giris_tarihi: '',
  ilgili_yonetici_kodu: '',
  sirket: '',
  grup: '',
  bolum: '',
  birim: '',
  kadro_grubu: '',
  kadro_unvani: '',
  gorev_unvani: '',
  arge_personeli: '',
  personel_sigorta_is_yeri: '',
  gorev_yeri: '',
}

// zorunluAlanlarDolu: Kaydet butonunu etkinleştirmek için zorunlu alanların
// (boşluk kırpılmış) dolu olup olmadığını döner. Sadece UX kontrolüdür.
function zorunluAlanlarDolu(form) {
  return (
    form.kullanici_kodu.trim() !== '' &&
    form.ad.trim() !== '' &&
    form.soyad.trim() !== '' &&
    form.email.trim() !== '' &&
    form.kullanici_turu !== ''
  )
}

// GeciciSifreKutusu: başarılı kayıt sonrası üretilen geçici şifreyi bir kez,
// kopyalanabilir düz metin olarak gösterir. Şifre yalnızca bu yanıttan gelir;
// hiçbir yere kalıcı yazılmaz. props: kullaniciKodu, geciciSifre, onGeriDon.
function GeciciSifreKutusu({ kullaniciKodu, geciciSifre, onGeriDon }) {
  const [kopyalandi, setKopyalandi] = useState(false)

  // kopyala: geçici şifreyi panoya kopyalar (destekleniyorsa). Sadece UX
  // kolaylığıdır; başarısız olursa kullanıcı metni elle seçebilir.
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(geciciSifre)
      setKopyalandi(true)
    } catch {
      // Pano API'si yoksa/engelliyse sessiz kal; metin zaten seçilebilir.
      setKopyalandi(false)
    }
  }

  return (
    <div className="kullanici-ekle-sonuc" role="status">
      <h3 className="kullanici-ekle-sonuc-baslik">Kullanıcı oluşturuldu</h3>
      <p className="kullanici-ekle-sonuc-metin">
        <strong>{kullaniciKodu}</strong> kodlu kullanıcı için geçici şifre
        üretildi. Bu şifreyi kullanıcıya iletin; kullanıcı ilk girişte kendi
        şifresini belirleyecek.
      </p>
      <div className="gecici-sifre-satiri">
        <input
          className="gecici-sifre-kutu"
          type="text"
          value={geciciSifre}
          readOnly
          onFocus={(olay) => olay.target.select()}
          aria-label="Geçici şifre"
        />
        <button type="button" className="ikincil-buton" onClick={kopyala}>
          {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <button type="button" className="birincil-buton" onClick={onGeriDon}>
        Kullanıcı Listesine Dön
      </button>
    </div>
  )
}

// KullaniciEkleForm: kullanıcı ekleme formunu yönetir (girdi toplama + gönderim).
// props: onGeriDon() -> "Geri Dön" ve başarı sonrası listeye dönüş için çağrılır.
function KullaniciEkleForm({ onGeriDon }) {
  const [form, setForm] = useState(BOS_FORM)
  const queryClient = useQueryClient()

  // Dropdown seçeneklerini çeker; kategoriye göre gruplanır. Liste boş/yüklenmiyor
  // olabilir — bu durumda dropdown'lar yalnızca placeholder gösterir (normaldir).
  const {
    data: secenekler,
    isError: secenekHatasi,
  } = useQuery({
    queryKey: ['secenekler'],
    queryFn: listSecenekler,
  })
  const gruplandirilmis = gruplaSeceneklerKategoriyeGore(secenekler)

  const ekleMutation = useMutation({
    mutationFn: createKullanici,
    onSuccess: () => {
      // Liste görünümü tazelensin diye kullanıcı sorgusu geçersiz kılınır.
      queryClient.invalidateQueries({ queryKey: ['kullanicilar'] })
    },
  })

  // alanGuncelle: tek bir form alanının değerini günceller.
  function alanGuncelle(kimlik, deger) {
    setForm((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // handleSubmit: formu gönderir. Zorunlu alanlar dolmadan buton pasif olduğundan
  // burada ek doğrulama yapılmaz; kayıt isteği API stub'ına iletilir.
  function handleSubmit(olay) {
    olay.preventDefault()
    if (!zorunluAlanlarDolu(form)) {
      return
    }
    ekleMutation.mutate(form)
  }

  // Başarılı kayıt: geçici şifre kutusunu göster (form yerine). Şifre bir kez
  // gösterilir; kullanıcı listeye döndüğünde form sıfırlanmış olur.
  if (ekleMutation.isSuccess) {
    return (
      <section className="kullanici-ekle">
        <GeciciSifreKutusu
          kullaniciKodu={ekleMutation.data.kullanici_kodu}
          geciciSifre={ekleMutation.data.gecici_sifre}
          onGeriDon={onGeriDon}
        />
      </section>
    )
  }

  const kaydetPasif = !zorunluAlanlarDolu(form) || ekleMutation.isPending

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">Kullanıcı Ekle</h2>

      <form className="kullanici-ekle-form" onSubmit={handleSubmit} noValidate>
        <div className="kullanici-ekle-izgara">
          {ZORUNLU_METIN_ALANLARI.map((alan) => (
            <label key={alan.kimlik} className="form-satir">
              <span className="form-etiket">
                {alan.etiket} <span className="zorunlu-yildiz">*</span>
              </span>
              <input
                className="form-kutu"
                type={alan.tip ?? 'text'}
                value={form[alan.kimlik]}
                onChange={(olay) => alanGuncelle(alan.kimlik, olay.target.value)}
              />
            </label>
          ))}

          <label className="form-satir">
            <span className="form-etiket">
              Kullanıcı Türü <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={form.kullanici_turu}
              onChange={(olay) => alanGuncelle('kullanici_turu', olay.target.value)}
            >
              <option value="">Seçiniz</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <label className="form-satir">
            <span className="form-etiket">İşe Giriş Tarihi</span>
            <input
              className="form-kutu"
              type="date"
              value={form.ise_giris_tarihi}
              onChange={(olay) =>
                alanGuncelle('ise_giris_tarihi', olay.target.value)
              }
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">İlgili Yönetici Kodu</span>
            <input
              className="form-kutu"
              type="text"
              value={form.ilgili_yonetici_kodu}
              onChange={(olay) =>
                alanGuncelle('ilgili_yonetici_kodu', olay.target.value)
              }
            />
          </label>

          {SECENEK_KATEGORILERI.map((kategori) => (
            <label key={kategori.kimlik} className="form-satir">
              <span className="form-etiket">{kategori.etiket}</span>
              <select
                className="form-kutu"
                value={form[kategori.kimlik]}
                onChange={(olay) =>
                  alanGuncelle(kategori.kimlik, olay.target.value)
                }
              >
                <option value="">Seçiniz</option>
                {(gruplandirilmis[kategori.kimlik] ?? []).map((deger) => (
                  <option key={deger} value={deger}>
                    {deger}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {secenekHatasi && (
          <p className="kullanici-ekle-uyari">
            Dropdown seçenekleri yüklenemedi; seçenekleri boş bırakabilir veya
            sayfayı yenileyebilirsiniz.
          </p>
        )}

        {ekleMutation.isError && (
          <div className="kullanici-ekle-hata" role="alert">
            {ekleMutation.error?.message ||
              'Kullanıcı eklenemedi. Lütfen tekrar deneyin.'}
          </div>
        )}

        <div className="kullanici-ekle-butonlar">
          {/* Kaydet pasifken disabled buton hover almadığından tooltip'i saran
              span üzerinden gösteririz; buton aktifken data-uyari verilmez. */}
          <span
            className="kaydet-sarmalayici"
            data-uyari={kaydetPasif ? 'Lütfen zorunlu alanları doldurun' : undefined}
          >
            <button type="submit" className="birincil-buton" disabled={kaydetPasif}>
              {ekleMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
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

export default KullaniciEkleForm
