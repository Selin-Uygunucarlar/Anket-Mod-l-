// Kullanıcı ekleme formu bileşeni. Admin panelinden "Kullanıcı Ekle" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// girdi toplar, dropdown seçeneklerini secenekApi'den ister ve kaydı createKullanici
// üzerinden backend'e iletir; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki ve
// asıl doğrulama sunucuda). Zorunlu alanların boş olup olmadığı yalnızca UX için
// (Kaydet butonunu pasifleştirmek) kontrol edilir. Başarıda üretilen geçici şifre
// bir kez gösterilir; localStorage'a/loga YAZILMAZ. Hata durumunda yalnızca
// backend'in güvenli mesajı gösterilir (teknik detay sızmaz). Kod/ad/soyad
// alanlarında yazarken uygulanan girdi süzme yalnızca erken UX geri bildirimidir,
// güvenlik/doğrulama sınırı değildir (asıl doğrulama sunucuda). Süzme sessiz
// kalmasın diye, bir alandan geçersiz karakter ayıklandığında o alana özel kısa
// bir uyarı belirir ve birkaç saniyede kendiliğinden kaybolur (yalnızca bilgilendirme).

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import { createKullanici } from '../api/kullaniciApi.js'
import {
  SECENEK_KATEGORILERI,
  gruplaSeceneklerKategoriyeGore,
} from '../common/secenekKategorileri.js'
import { sadeceRakam, rakamlariAt } from '../common/girdiTemizle.js'
import GeciciSifreKutusu from './GeciciSifreKutusu.jsx'
import '../styles/kullanici-ekle.css'

// Zorunlu metin alanları (gösterim sırasıyla). Zorunluluk yalnızca UX içindir;
// asıl doğrulama sunucudadır. Opsiyonel alan özellikleri (temizle, inputMode,
// maxLength) yazarken erken UX geri bildirimi sağlar, doğrulama değildir.
const ZORUNLU_METIN_ALANLARI = [
  {
    kimlik: 'kullanici_kodu',
    etiket: 'Kullanıcı Kodu',
    temizle: 'sadeceRakam',
    inputMode: 'numeric',
    pattern: '[0-9]*',
    maxLength: 20,
  },
  { kimlik: 'ad', etiket: 'Ad', temizle: 'harf', maxLength: 100 },
  { kimlik: 'soyad', etiket: 'Soyad', temizle: 'harf', maxLength: 100 },
  { kimlik: 'email', etiket: 'E-posta', tip: 'email' },
]

// temizleAlanDegeri: alanın "temizle" bayrağına göre ham girdiyi anında süzer
// (kod alanında rakam-dışı ayıklama, ad/soyad'da rakam ayıklama). Bayrak yoksa
// değeri olduğu gibi döner. Yalnızca yazarken UX kolaylığıdır, doğrulama değildir.
function temizleAlanDegeri(temizle, hamDeger) {
  if (temizle === 'sadeceRakam') {
    return sadeceRakam(hamDeger)
  }
  if (temizle === 'harf') {
    return rakamlariAt(hamDeger)
  }
  return hamDeger
}

// Bir alandan geçersiz karakter ayıklandığında beliren anlık uyarının ekranda
// kalma süresi (ms). Son geçersiz girişten sonra bu süre geçince uyarı kaybolur.
const UYARI_SURESI_MS = 2800

// ayiklamaUyarisi: alanın süzme tipine göre, geçersiz karakter ayıklandığında
// gösterilecek kısa kullanıcı mesajını döner. Rakam-only kod alanları ile
// ad/soyad alanları farklı, alana uygun metin alır.
function ayiklamaUyarisi(alan) {
  if (alan.temizle === 'sadeceRakam') {
    return 'Sadece rakam girilebilir.'
  }
  if (alan.temizle === 'harf') {
    return `${alan.etiket} alanına rakam girilemez.`
  }
  return ''
}

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

// KullaniciEkleForm: kullanıcı ekleme formunu yönetir (girdi toplama + gönderim).
// props: onGeriDon() -> "Geri Dön" ve başarı sonrası listeye dönüş için çağrılır.
function KullaniciEkleForm({ onGeriDon }) {
  const [form, setForm] = useState(BOS_FORM)
  // Alan kimliği -> o an gösterilen anlık uyarı mesajı. Yalnızca uyarısı olan
  // alanlar bu haritada bulunur; her alan bağımsızdır.
  const [alanUyarilari, setAlanUyarilari] = useState({})
  // Alan başına aktif zamanlayıcı kimliğini tutar (state değil; render tetiklemez).
  // Unmount'ta ve yenilemede temizlenir, böylece unmount sonrası setState olmaz.
  const zamanlayicilarRef = useRef({})
  const queryClient = useQueryClient()

  // Bileşen unmount olurken bekleyen tüm uyarı zamanlayıcılarını temizler
  // (memory leak / unmount sonrası setState uyarısını önler).
  useEffect(() => {
    const zamanlayicilar = zamanlayicilarRef.current
    return () => {
      Object.values(zamanlayicilar).forEach(clearTimeout)
    }
  }, [])

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

  // uyariTetikle: bir alanda geçersiz karakter ayıklandığında o alana özel kısa
  // uyarıyı gösterir. Art arda geçersiz girişte önceki zamanlayıcıyı yeniler
  // (uyarı görünür kalır) ve son girişten UYARI_SURESI_MS sonra uyarıyı kaldırır.
  function uyariTetikle(kimlik, mesaj) {
    setAlanUyarilari((oncekiler) => ({ ...oncekiler, [kimlik]: mesaj }))
    const zamanlayicilar = zamanlayicilarRef.current
    if (zamanlayicilar[kimlik]) {
      clearTimeout(zamanlayicilar[kimlik])
    }
    zamanlayicilar[kimlik] = setTimeout(() => {
      setAlanUyarilari((oncekiler) => {
        const guncel = { ...oncekiler }
        delete guncel[kimlik]
        return guncel
      })
      delete zamanlayicilar[kimlik]
    }, UYARI_SURESI_MS)
  }

  // suzVeGuncelle: alanın ham girdisini temizleAlanDegeri ile süzer ve alanı
  // günceller; süzme sırasında en az bir karakter ayıklandıysa (temiz < ham)
  // alana uygun anlık uyarıyı tetikler. Süzme + uyarı için tek giriş noktasıdır.
  function suzVeGuncelle(kimlik, temizle, hamDeger, uyariMesaji) {
    const temiz = temizleAlanDegeri(temizle, hamDeger)
    alanGuncelle(kimlik, temiz)
    if (temiz.length < hamDeger.length) {
      uyariTetikle(kimlik, uyariMesaji)
    }
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
              <span className="form-alan">
                <input
                  className="form-kutu"
                  type={alan.tip ?? 'text'}
                  value={form[alan.kimlik]}
                  inputMode={alan.inputMode}
                  pattern={alan.pattern}
                  maxLength={alan.maxLength}
                  onChange={(olay) =>
                    suzVeGuncelle(
                      alan.kimlik,
                      alan.temizle,
                      olay.target.value,
                      ayiklamaUyarisi(alan)
                    )
                  }
                />
                {alanUyarilari[alan.kimlik] && (
                  <span className="alan-uyari" role="status">
                    {alanUyarilari[alan.kimlik]}
                  </span>
                )}
              </span>
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
            <span className="form-alan">
              <input
                className="form-kutu"
                type="text"
                value={form.ilgili_yonetici_kodu}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={20}
                onChange={(olay) =>
                  suzVeGuncelle(
                    'ilgili_yonetici_kodu',
                    'sadeceRakam',
                    olay.target.value,
                    'Sadece rakam girilebilir.'
                  )
                }
              />
              {alanUyarilari.ilgili_yonetici_kodu && (
                <span className="alan-uyari" role="status">
                  {alanUyarilari.ilgili_yonetici_kodu}
                </span>
              )}
            </span>
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
