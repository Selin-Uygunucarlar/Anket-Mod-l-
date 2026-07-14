// Kullanıcı yönetimi API erişim noktası — sunum katmanının backend'e bakan
// TEK yeri. UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonu çağırır.
// Backend HTTP endpoint'i (GET /api/kullanicilar) burada bağlıdır; istek/yanıt
// şekli ~/Desktop/kontratlar.txt "KULLANICI LİSTESİ ÖZELLİĞİ" ile birebir.
// Oturum httpOnly cookie ile taşındığından credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajı (teknik detay yok).
const GENEL_HATA_MESAJI = 'Kullanıcılar yüklenemedi. Lütfen tekrar deneyin.'

// listKullanicilar: admin kullanıcı listesini backend'den çeker.
// Başarılıysa kullanıcı özetlerinin dizisini döndürür; başarısızsa backend'in
// güvenli mesajını (ör. 403 yetki mesajı) taşıyan bir Error fırlatır. Ağ/parse
// hatasında da teknik detay sızdırmadan güvenli bir Error yükselir.
export async function listKullanicilar() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/kullanicilar`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    // Ağ hatası (backend kapalı, bağlantı yok vb.) — teknik detay sızdırmadan
    // güvenli, anlaşılır bir mesaj yükseltilir.
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  // Backend hata durumunda da güvenli JSON gövde döndürür; her durumda okunur.
  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(GENEL_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.kullanicilar
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || GENEL_HATA_MESAJI)
}

// Kullanıcı detayı yüklenirken gösterilecek jenerik, güvenli hata mesajı.
const DETAY_HATA_MESAJI = 'Kullanıcı detayı yüklenemedi. Lütfen tekrar deneyin.'

// getKullaniciDetay: verilen sicil koduna ait kullanıcının tüm detayını çeker.
// Başarılıysa detay nesnesini (govde.kullanici) döndürür; başarısızsa backend'in
// güvenli mesajını (404 kayıt yok, 403 yetki, 401 oturum) taşıyan bir Error
// fırlatır. Ağ/parse hatasında da teknik detay sızdırmadan güvenli Error yükselir.
export async function getKullaniciDetay(kullaniciKodu) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/kullanicilar/${encodeURIComponent(kullaniciKodu)}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    )
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(DETAY_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.kullanici
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || DETAY_HATA_MESAJI)
}

// Kullanıcı eklemede gösterilecek jenerik, güvenli hata mesajı (teknik detay yok).
const EKLE_HATA_MESAJI = 'Kullanıcı eklenemedi. Lütfen tekrar deneyin.'

// createKullanici: yeni kullanıcı oluşturur (yalnızca admin; yetki sunucuda).
// veri, form alanlarını içeren düz nesnedir; boş opsiyoneller boş string olarak
// gönderilir, backend normalize eder. Başarılıysa { kullanici_kodu, gecici_sifre }
// döndürür (geçici şifre admin'e bir kez iletilir). Başarısızsa backend'in
// güvenli mesajını taşıyan Error fırlar; ağ/parse hatasında da güvenli Error.
export async function createKullanici(veri) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/kullanicilar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(veri),
      credentials: 'include',
    })
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(EKLE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return {
      kullanici_kodu: govde.kullanici_kodu,
      gecici_sifre: govde.gecici_sifre,
    }
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || EKLE_HATA_MESAJI)
}

// Kullanıcı güncellemede gösterilecek jenerik, güvenli hata mesajı (teknik detay yok).
const GUNCELLE_HATA_MESAJI = 'Kullanıcı güncellenemedi. Lütfen tekrar deneyin.'

// guncelleKullanici: mevcut bir kullanıcının bilgilerini günceller (yalnızca
// admin; yetki sunucuda). kullaniciKodu path'e giden kaydın MEVCUT sicilidir;
// veri, ekleme (createKullanici) ile BİREBİR AYNI alan kümesidir ve veri.kullanici_kodu
// istenen (aynı ya da yeni) sicili taşır. Başarılıysa { kullanici_kodu } (güncel/yeni
// sicil) döndürür. Başarısızsa backend'in güvenli mesajını (ör. 409 bağlı kayıt,
// 400 doğrulama, 404 kayıt yok, 403 yetki) taşıyan Error fırlar; ağ/parse hatasında
// da teknik detay sızdırmadan güvenli Error yükselir.
export async function guncelleKullanici(kullaniciKodu, veri) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/kullanicilar/${encodeURIComponent(kullaniciKodu)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(veri),
        credentials: 'include',
      },
    )
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(GUNCELLE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return { kullanici_kodu: govde.kullanici_kodu }
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || GUNCELLE_HATA_MESAJI)
}

// Durum değiştirmede gösterilecek jenerik, güvenli hata mesajı (teknik detay yok).
const AKTIFLIK_HATA_MESAJI = 'Kullanıcı durumu değiştirilemedi. Lütfen tekrar deneyin.'

// degistirAktiflik: verilen kullanıcının aktif/pasif durumunu tersine çevirir
// (yalnızca admin; yetki ve toggle kararı sunucuda). Gövde göndermez; sunucu
// mevcut durumun tersini yazar. Başarılıysa { kullanici_kodu, aktif } (yeni
// durum) döndürür. Başarısızsa backend'in güvenli mesajını (ör. 403 YETKI_YOK,
// 404 NOT_FOUND, 400 "Kendi hesabınızı pasife alamazsınız.") taşıyan Error
// fırlar; ağ/parse hatasında da teknik detay sızdırmadan güvenli Error.
export async function degistirAktiflik(kullaniciKodu) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/kullanicilar/${encodeURIComponent(kullaniciKodu)}/aktiflik`,
      {
        method: 'POST',
        credentials: 'include',
      },
    )
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(AKTIFLIK_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return { kullanici_kodu: govde.kullanici_kodu, aktif: govde.aktif }
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || AKTIFLIK_HATA_MESAJI)
}
