// Kullanıcı ekleme/düzenleme formunun paylaşılan alan tanımları ve saf yardımcı
// fonksiyonları. Hem KullaniciEkleForm (mantık/kapsayıcı) hem KullaniciFormGovde
// (ortak form gövdesi) buradan beslenir (DRY). Yalnızca sunum/girdi biçimlemesi
// içerir; iş kuralı, hesaplama veya doğrulama sınırı taşımaz (asıl doğrulama
// sunucuda). Alan zorunlulukları yalnızca UX içindir.

import { sadeceRakam, rakamlariAt } from './girdiTemizle.js'

// Zorunlu metin alanları (gösterim sırasıyla). Zorunluluk yalnızca UX içindir;
// asıl doğrulama sunucudadır. Opsiyonel alan özellikleri (temizle, inputMode,
// maxLength) yazarken erken UX geri bildirimi sağlar, doğrulama değildir.
export const ZORUNLU_METIN_ALANLARI = [
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

// Bir alandan geçersiz karakter ayıklandığında beliren anlık uyarının ekranda
// kalma süresi (ms). Son geçersiz girişten sonra bu süre geçince uyarı kaybolur.
export const UYARI_SURESI_MS = 2800

// Formun tüm alanları için boş başlangıç durumu. Tüm dropdown ve opsiyonel
// alanlar boş string ile başlar (backend boş opsiyonelleri normalize eder).
export const BOS_FORM = {
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

// temizleAlanDegeri: alanın "temizle" bayrağına göre ham girdiyi anında süzer
// (kod alanında rakam-dışı ayıklama, ad/soyad'da rakam ayıklama). Bayrak yoksa
// değeri olduğu gibi döner. Yalnızca yazarken UX kolaylığıdır, doğrulama değildir.
export function temizleAlanDegeri(temizle, hamDeger) {
  if (temizle === 'sadeceRakam') {
    return sadeceRakam(hamDeger)
  }
  if (temizle === 'harf') {
    return rakamlariAt(hamDeger)
  }
  return hamDeger
}

// ayiklamaUyarisi: alanın süzme tipine göre, geçersiz karakter ayıklandığında
// gösterilecek kısa kullanıcı mesajını döner. Rakam-only kod alanları ile
// ad/soyad alanları farklı, alana uygun metin alır.
export function ayiklamaUyarisi(alan) {
  if (alan.temizle === 'sadeceRakam') {
    return 'Sadece rakam girilebilir.'
  }
  if (alan.temizle === 'harf') {
    return `${alan.etiket} alanına rakam girilemez.`
  }
  return ''
}

// zorunluAlanlarDolu: Kaydet/Güncelle butonunu etkinleştirmek için zorunlu
// alanların (boşluk kırpılmış) dolu olup olmadığını döner. Sadece UX kontrolüdür.
export function zorunluAlanlarDolu(form) {
  return (
    form.kullanici_kodu.trim() !== '' &&
    form.ad.trim() !== '' &&
    form.soyad.trim() !== '' &&
    form.email.trim() !== '' &&
    form.kullanici_turu !== ''
  )
}
