// Kullanıcı ekleme ve düzenleme ekranlarının ORTAK form gövdesi (DRY). Yalnızca
// sunum sorumluluğundadır: props ile gelen form değerlerini gösterir, girdi
// değişikliklerini yukarıya iletir; iş kuralı, yetki veya hesaplama İÇERMEZ.
// Başlık, kaydet butonunun metni, hata mesajı ve tüm handler'lar dışarıdan
// (KullaniciEkleForm) verilir; böylece iki mod aynı arayüzü paylaşır. Kod/ad/
// soyad alanlarındaki girdi süzme yalnızca erken UX geri bildirimidir, güvenlik/
// doğrulama sınırı değildir (asıl doğrulama sunucuda).

import {
  ZORUNLU_METIN_ALANLARI,
  ayiklamaUyarisi,
} from '../common/kullaniciFormAlanlari.js'
import { SECENEK_KATEGORILERI } from '../common/secenekKategorileri.js'
import '../styles/kullanici-ekle.css'

// KullaniciFormGovde: form ızgarasını (zorunlu metin alanları, kullanıcı türü,
// tarih, yönetici kodu ve 10 dropdown), seçenek/kaydet hatalarını ve alt
// butonları render eder.
// props:
//   baslik            -> ekran başlığı ("Kullanıcı Ekle" / "Kullanıcı Düzenle")
//   form              -> alan kimliği -> değer haritası (kontrollü girdiler)
//   alanUyarilari     -> alan kimliği -> o an gösterilen anlık süzme uyarısı
//   suzVeGuncelle()   -> süzülen metin alanları için (kimlik, temizle, ham, mesaj)
//   alanGuncelle()    -> süzme gerektirmeyen alanlar için (kimlik, değer)
//   gruplandirilmis   -> kategori -> [seçenek değerleri] (dropdown içerikleri)
//   secenekHatasi     -> dropdown seçenekleri yüklenemediyse true (uyarı gösterir)
//   hataMesaji        -> kaydet/güncelle hatası güvenli mesajı ('' ise gizli)
//   kaydetPasif       -> Kaydet/Güncelle butonu pasif mi (UX; zorunlu alan/istek)
//   butonMetni        -> kaydet butonunun anlık metni (pending dahil)
//   onSubmit()        -> form gönderilince
//   onGeriDon()       -> "Geri Dön" tıklanınca
function KullaniciFormGovde({
  baslik,
  form,
  alanUyarilari,
  suzVeGuncelle,
  alanGuncelle,
  gruplandirilmis,
  secenekHatasi,
  hataMesaji,
  kaydetPasif,
  butonMetni,
  onSubmit,
  onGeriDon,
}) {
  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">{baslik}</h2>

      <form className="kullanici-ekle-form" onSubmit={onSubmit} noValidate>
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

        {hataMesaji && (
          <div className="kullanici-ekle-hata" role="alert">
            {hataMesaji}
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
              {butonMetni}
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

export default KullaniciFormGovde
