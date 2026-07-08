// Anket oluşturma/güncelleme formunun paylaşılan alan/seçenek tanımları ve saf
// yardımcı fonksiyonu. AnketEkleForm buradan beslenir; sabitler tek yerde tutulur
// (DRY) ve bileşen dosyasının 400 satır sınırının altında kalması sağlanır.
// Yalnızca sunum/girdi biçimlemesi içerir; iş kuralı, hesaplama veya doğrulama
// sınırı taşımaz (asıl doğrulama sunucuda). Alan zorunlulukları yalnızca UX içindir.

// Anket tipi seçenekleri (bu sırayla). Zorunlu radyo grubudur; varsayılan seçili
// yoktur. Tek yerde tanımlanıp render'da .map ile üretilir (DRY).
export const ANKET_TIPI_SECENEKLERI = [
  'Kullanıcı Bilgi Anketi',
  'Etkinlik Değerlendirme Anketi',
  'Eğitim Değerlendirme Anketi',
  'Etkinlik Davranış Anketi',
  'Eğitim Davranış Anketi',
]

// Durum radyo grubu seçenekleri. Görünen metin ile state'te tutulan değer
// aynıdır; varsayılan olarak "Aktif" seçilidir.
export const DURUM_SECENEKLERI = ['Aktif', 'Pasif']

// Erişim seviyesi dropdown seçenekleri (bu sırayla). İlk seçenek placeholder
// "Seçiniz"dir (boş değer) ve bu dizide yer almaz.
export const ERISIM_SEVIYESI_SECENEKLERI = [
  'Çalışma grubumdakiler ve ben görebilir ve yönetebiliriz',
  'Sadece ben görebilir ve yönetebilirim',
  'Herkes görebilir ve yönetebilir',
]

// Başlangıç Tarihi radyo seçenekleri (bu sırayla). Görünen metin (etiket) ile
// state'te tutulan değer (deger) FARKLI olduğundan { deger, etiket } nesne dizisi
// kullanılır; zorunlu gruptur, varsayılan seçili yoktur. "bugun"/"yarin" için
// gerçek tarih HESAPLANMAZ; hesap ileride servis katmanına bırakılır.
export const BASLANGIC_TARIHI_SECENEKLERI = [
  { deger: 'bugun', etiket: 'Bugün' },
  { deger: 'yarin', etiket: 'Yarın' },
  { deger: 'tarih_sec', etiket: 'Tarih seç' },
]

// Bitiş Tarihi radyo seçenekleri (bu sırayla). Aynı { deger, etiket } kalıbı; "bir_ay"
// /"iki_ay" için gerçek tarih HESAPLANMAZ, seçim yalnızca state'te tutulur.
export const BITIS_TARIHI_SECENEKLERI = [
  { deger: 'bir_ay', etiket: 'Bir Ay' },
  { deger: 'iki_ay', etiket: 'İki Ay' },
  { deger: 'tarih_sec', etiket: 'Tarih seç' },
]

// "Kullanıcılar" kartı seçenekleri (bu sırayla). Checkbox grubudur: ikisi de
// aynı anda işaretlenebilir. { deger, etiket } kalıbı; state'te seçili degerler
// dizisi tutulur. GERÇEK ATAMA/HESAP YAPILMAZ; yalnızca hangi seçeneklerin
// işaretlendiği state'te tutulur (mevcut tarih seçimi felsefesiyle aynı).
export const KULLANICI_ATAMA_SECENEKLERI = [
  { deger: 'sabit_liste', etiket: 'Sabit liste' },
  { deger: 'kullanici_gruplari', etiket: 'Kullanıcı Grupları' },
]

// "İşlemler" kartı seçenekleri (bu sırayla). Checkbox grubudur: birden çok seçenek
// aynı anda işaretlenebilir. { deger, etiket } kalıbı; state'te seçili degerler dizisi
// tutulur. GERÇEK İŞLEV YOK; yalnızca hangi seçeneklerin işaretlendiği state'te tutulur.
export const ISLEM_SECENEKLERI = [
  { deger: 'anket_zorunlu', etiket: 'Anketi almak zorunlu olsun' },
  { deger: 'anasayfada_goster', etiket: 'Anket ana sayfada gösterilsin' },
  { deger: 'yanit_guncellenebilir', etiket: 'Kullanıcılar yanıtlarını güncelleyebilsin' },
  { deger: 'sira_no_goster', etiket: 'Anket cevaplama esnasında sıra numaraları gösterilsin' },
]

// "İşlemler" kartındaki soru gösterim biçimi radyo seçenekleri (bu sırayla). Birbirini
// dışlayan gruptur; zorunlu DEĞİLDİR ama varsayılan olarak bir seçenek seçilidir.
// { deger, etiket } kalıbı; state'te tek deger tutulur. GERÇEK İŞLEV YOK.
export const SORU_GOSTERIM_SECENEKLERI = [
  { deger: 'tek_sayfa_tum', etiket: 'Tek sayfada tüm sorular çıksın' },
  { deger: 'sayfa_basi_grup', etiket: 'Her sayfada tek soru grubu çıksın' },
  { deger: 'sayfa_basi_tek', etiket: 'Her sayfada tek soru çıksın' },
]

// "gün önce" kutusuna rakam dışı karakter girildiğinde beliren anlık uyarının
// ekranda kalma süresi (ms). Son geçersiz girişten sonra bu süre geçince kaybolur.
export const UYARI_SURESI_MS = 2800

// "Mesaj Ayarları" kartındaki 2. seçeneğin hatırlatma sıklığı dropdown'ı için
// seçenekler (bu sırayla): "kaç günde bir" hatırlatılacağı. Görünen metin ile
// state'te tutulan değer aynıdır; varsayılan '1'dir. GERÇEK HATIRLATMA GÖNDERİLMEZ;
// yalnızca seçilen sıklık state'te tutulur.
export const HATIRLATMA_SIKLIGI_SECENEKLERI = ['1', '2']

// Formun başlangıç değerleri: metin alanları boş, Durum "Aktif", Anket Tipi ve
// Erişim Seviyesi seçilmemiş (boş), tarih seçimleri yapılmamış (boş).
export const BOS_ANKET_FORMU = {
  adi: '',
  on_yazi: '',
  son_yazi: '',
  aciklama: '',
  durum: 'Aktif',
  anket_tipi: '',
  erisim_seviyesi: '',
  baslangic_secim: '', // 'bugun' | 'yarin' | 'tarih_sec'
  baslangic_tarih: '', // yalnızca 'tarih_sec' seçiliyken anlamlı; <input type="date"> değeri
  bitis_secim: '', // 'bir_ay' | 'iki_ay' | 'tarih_sec'
  bitis_tarih: '', // yalnızca 'tarih_sec' seçiliyken anlamlı; <input type="date"> değeri
  kullanici_atama: [], // seçili atama seçenekleri: 'sabit_liste' ve/veya 'kullanici_gruplari'; checkbox grubu, ikisi de seçilebilir
  mesaj_baslangic_mail: false, // "Başlangıçtan 1 gün önce mail gönderilsin" bağımsız checkbox; gerçek mail GÖNDERİLMEZ
  mesaj_hatirlatma: false, // "Bitişten X gün önce, N günde bir hatırlatma" bağımsız checkbox; aşağıdaki iki alanı aktifleştirir
  hatirlatma_gun_once: '', // yalnızca mesaj_hatirlatma seçiliyken anlamlı; "kaç gün önce" sayı girdisi değeri (min 1)
  hatirlatma_sikligi: '1', // yalnızca mesaj_hatirlatma seçiliyken anlamlı; '1' | '2' dropdown, varsayılan '1'
  mesaj_stil_sablonu: false, // "Mesajlar Stil şablonu ile gönderilsin" bağımsız checkbox; gerçek gönderim YAPILMAZ
  islem_secenekleri: ['anket_zorunlu'], // İşlemler kartı checkbox grubu; varsayılan "Anketi almak zorunlu olsun" işaretli
  soru_gosterim: 'tek_sayfa_tum', // Soru gösterim biçimi radyo grubu; varsayılan "Tek sayfada tüm sorular çıksın"
}

// tarihAlaniGecersiz: bir zorunlu tarih alanının Kaydet için "eksik" olup olmadığını
// söyler. Seçim hiç yapılmamışsa VEYA "tarih_sec" seçili ama takvim boşsa geçersizdir.
// Saf UX kontrolüdür (Kaydet'i pasifleştirir), güvenlik/doğrulama sınırı değildir.
export function tarihAlaniGecersiz(secim, tarih) {
  if (secim === '') return true
  if (secim === 'tarih_sec' && tarih.trim() === '') return true
  return false
}
