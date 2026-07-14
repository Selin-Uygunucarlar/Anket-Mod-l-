// Yönetilen seçenekler (dropdown değerleri) API erişim noktası — sunum
// katmanının backend'e bakan TEK yeri. UI bileşenleri doğrudan istek atmaz;
// buradaki fonksiyonları çağırır. Backend endpoint'leri (GET/POST/DELETE
// /api/secenekler) burada bağlıdır; istek/yanıt şekli ~/Desktop/kontratlar.txt
// "KULLANICI EKLEME + YÖNETİLEN SEÇENEKLER" bloğuyla birebir. Oturum httpOnly
// cookie ile taşındığından credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Seçenekler yüklenemedi. Lütfen tekrar deneyin.'
const EKLE_HATA_MESAJI = 'Seçenek eklenemedi. Lütfen tekrar deneyin.'
const SIL_HATA_MESAJI = 'Seçenek silinemedi. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// listSecenekler: tanımlı tüm dropdown seçeneklerini backend'den çeker.
// Başarılıysa [{ kategori, deger }] dizisini döndürür; başarısızsa backend'in
// güvenli mesajını taşıyan bir Error fırlatır. Ağ/parse hatasında da güvenli Error.
export async function listSecenekler() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/secenekler`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(LISTE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.secenekler
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || LISTE_HATA_MESAJI)
}

// ekleSecenek: verilen kategoriye yeni bir değer ekler (yalnızca admin; yetki
// sunucuda). Başarıda sessizce döner. Zaten tanımlı seçenek (SECENEK_ZATEN_VAR)
// dahil başarısız durumlarda backend'in güvenli mesajını taşıyan Error fırlar.
export async function ekleSecenek(kategori, deger) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/secenekler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategori, deger }),
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(EKLE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false (dup dahil) — oturum sona erdiyse sinyal yay; güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || EKLE_HATA_MESAJI)
}

// silSecenek: verilen kategorideki bir değeri siler (yalnızca admin; yetki
// sunucuda). Backend idempotenttir: kayıt yoksa da başarı döner. Başarıda
// sessizce döner; başarısız durumlarda backend'in güvenli mesajını taşıyan
// Error fırlar (ağ/parse hatasında güvenli jenerik mesaj).
export async function silSecenek(kategori, deger) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/secenekler`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kategori, deger }),
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(SIL_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || SIL_HATA_MESAJI)
}
