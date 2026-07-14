// Kullanıcı grupları API erişim noktası — sunum katmanının backend'e bakan
// TEK yeri. UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonları çağırır.
// Backend endpoint'leri (GET/POST/DELETE /api/gruplar ve .../uyeler) burada
// bağlıdır; istek/yanıt şekli ~/Desktop/kontratlar.txt "KULLANICI GRUPLARI"
// bloğuyla birebir. Tüm uçlar admin-only (yetki sunucuda) ve oturum httpOnly
// cookie ile taşındığından credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Gruplar yüklenemedi. Lütfen tekrar deneyin.'
const EKLE_HATA_MESAJI = 'Grup eklenemedi. Lütfen tekrar deneyin.'
const SIL_HATA_MESAJI = 'Grup silinemedi. Lütfen tekrar deneyin.'
const UYELER_HATA_MESAJI = 'Grup üyeleri yüklenemedi. Lütfen tekrar deneyin.'
const ATA_HATA_MESAJI = 'Kullanıcı gruba eklenemedi. Lütfen tekrar deneyin.'
const CIKAR_HATA_MESAJI = 'Kullanıcı gruptan çıkarılamadı. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// listGruplar: tanımlı tüm grupları üye sayılarıyla backend'den çeker.
// Başarılıysa [{ grup_id, ad, uye_sayisi }] dizisini döndürür; başarısızsa
// backend'in güvenli mesajını taşıyan Error fırlar. Ağ/parse hatasında da güvenli.
export async function listGruplar() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/gruplar`, {
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
    return govde.gruplar
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || LISTE_HATA_MESAJI)
}

// ekleGrup: verilen ad ile yeni bir grup oluşturur (yalnızca admin; yetki
// sunucuda). Başarılıysa { grup_id } döndürür. Zaten var olan ad dahil başarısız
// durumlarda backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse'ta güvenli).
export async function ekleGrup(ad) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/gruplar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad }),
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
    return { grup_id: govde.grup_id }
  }

  // basari:false (zaten var dahil) — oturum sona erdiyse sinyal yay; güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || EKLE_HATA_MESAJI)
}

// silGrup: verilen grubu siler (yalnızca admin; yetki sunucuda). Backend
// idempotenttir (kayıt yoksa da başarı); üyeler otomatik grupsuz kalır. Başarıda
// sessizce döner; başarısızsa backend'in güvenli mesajını taşıyan Error fırlar.
export async function silGrup(grupId) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/gruplar/${encodeURIComponent(grupId)}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
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

// listGrupUyeleri: verilen grubun üyelerini backend'den çeker. Başarılıysa
// [{ kullanici_kodu, ad, soyad, email }] dizisini döndürür (üyesi yoksa boş dizi);
// başarısızsa backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse'ta güvenli).
export async function listGrupUyeleri(grupId) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/gruplar/${encodeURIComponent(grupId)}/uyeler`,
      {
        method: 'GET',
        credentials: 'include',
      },
    )
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(UYELER_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.uyeler
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || UYELER_HATA_MESAJI)
}

// grubaAta: verilen kullanıcıyı verilen gruba üye yapar (yalnızca admin; yetki
// sunucuda). Tek grup kuralı gereği kullanıcı başka gruptaysa yeni gruba taşınır;
// bu kararı backend verir, UI ek kural koymaz. Başarıda sessizce döner; başarısızsa
// backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse'ta güvenli).
export async function grubaAta(grupId, kullaniciKodu) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/gruplar/${encodeURIComponent(grupId)}/uyeler`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_kodu: kullaniciKodu }),
        credentials: 'include',
      },
    )
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(ATA_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || ATA_HATA_MESAJI)
}

// gruptanCikar: verilen kullanıcıyı verilen gruptan çıkarır (yalnızca admin;
// yetki sunucuda). Grup kimliği yalnızca REST semantiği içindir; tek grup kuralı
// gereği kullanıcı grupsuz kalır. Başarıda sessizce döner; başarısızsa backend'in
// güvenli mesajını taşıyan Error fırlar (ağ/parse'ta güvenli).
export async function gruptanCikar(grupId, kullaniciKodu) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/gruplar/${encodeURIComponent(grupId)}/uyeler/${encodeURIComponent(
        kullaniciKodu,
      )}`,
      {
        method: 'DELETE',
        credentials: 'include',
      },
    )
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(CIKAR_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || CIKAR_HATA_MESAJI)
}
