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

// E-posta biçimi: yalnızca erken UX geri bildirimi için kullanılan desen. Asıl
// (bağlayıcı) e-posta kuralı sunucudadır; buradaki kopya, kullanıcıyı sunucu
// yanıtını beklemeden uyarmak içindir, katmanlar arası bir doğrulama sınırı değil.
const EPOSTA_DESENI = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
const ASCII_DISI_KARAKTER = /[^\x00-\x7F]/

// E-posta uyarısı iki parçadır çünkü gösterim zamanları farklıdır: karakter
// uyarısı yazarken anında verilebilir (kesin hata), biçim uyarısı ise ancak alan
// terk edilince anlamlıdır (yarım yazılmış adres henüz hata değildir). İkisi de
// değeri süzmez/değiştirmez: yazılan karakter alanda kalır, yalnızca uyarılır.

// epostaKarakterUyarisi: ASCII dışı karakter varsa uyarıyı döner, yoksa ''.
// Boş alan uyarı üretmez (zorunluluk zaten butonu pasif tutar).
export function epostaKarakterUyarisi(deger) {
  const kirpilmis = (deger ?? '').trim()
  if (kirpilmis !== '' && ASCII_DISI_KARAKTER.test(kirpilmis)) {
    return 'E-posta yalnızca İngilizce karakter içerebilir.'
  }
  return ''
}

// epostaBicimUyarisi: karakterler uygun ama adres desene uymuyorsa uyarıyı döner,
// yoksa ''. Yalnızca alandan çıkınca gösterilir; yazarken erken uyarmaz.
export function epostaBicimUyarisi(deger) {
  const kirpilmis = (deger ?? '').trim()
  if (kirpilmis !== '' && !EPOSTA_DESENI.test(kirpilmis)) {
    return 'Geçerli bir e-posta adresi giriniz.'
  }
  return ''
}

// zorunluAlanlarDolu: Kaydet/Güncelle butonunu etkinleştirmek için zorunlu
// alanların dolu ve e-postanın biçimce kabul edilebilir olup olmadığını döner.
// Uyarı henüz ekranda görünmese de (yazarken) buton pasif kalır. Sadece UX
// kontrolüdür; sunucu doğrulamasının yerine geçmez.
export function zorunluAlanlarDolu(form) {
  return (
    form.kullanici_kodu.trim() !== '' &&
    form.ad.trim() !== '' &&
    form.soyad.trim() !== '' &&
    form.email.trim() !== '' &&
    epostaKarakterUyarisi(form.email) === '' &&
    epostaBicimUyarisi(form.email) === '' &&
    form.kullanici_turu !== ''
  )
}
