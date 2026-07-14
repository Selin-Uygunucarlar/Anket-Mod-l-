// Anket API erişim noktası — sunum katmanının backend'e bakan TEK yeri. UI
// bileşenleri doğrudan istek atmaz; buradaki fonksiyonları çağırır. Backend
// endpoint'leri (GET /api/anketler, POST /api/anketler) burada bağlıdır; istek/
// yanıt şekli ~/Desktop/kontratlar.txt "ANKET OLUŞTURMA + LİSTELEME (Faz 1)"
// bloğuyla birebir. Her iki uç da admin-only'dir (yetki sunucuda) ve oturum
// httpOnly cookie ile taşındığından credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Anketler yüklenemedi. Lütfen tekrar deneyin.'
const EKLE_HATA_MESAJI = 'Anket kaydedilemedi. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// anketleriGetir: tüm anketleri liste ekranı için backend'den çeker. Başarılıysa
// [{ anket_id, ad, durum, olusturan_ad, olusturan_soyad, olusturma_tarihi,
// atanan_sayisi, yanitlayan_sayisi }] dizisini döndürür. Başarısızsa backend'in
// güvenli mesajını (ör. 403 yetki, 401 oturum) taşıyan bir Error fırlatır;
// ağ/parse hatasında da teknik detay sızdırmadan güvenli Error yükselir.
export async function anketleriGetir() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler`, {
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
    return govde.anketler
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || LISTE_HATA_MESAJI)
}

// ekleAnket: yeni bir anketi backend'e kaydeder (yalnızca admin; yetki ve asıl
// doğrulama sunucuda). govde = { ad, on_yazi, son_yazi, aciklama, durum,
// anket_tipi, erisim_seviyesi, baslangic_secim, baslangic_tarih, bitis_secim,
// bitis_tarih, soru_idler }. Tarihler SUNUCUDA hesaplanır: UI yalnızca hangi
// seçeneğin seçildiğini (baslangic_secim/bitis_secim) taşır. olusturan_kodu ve
// erişim grubu GÖNDERİLMEZ; ikisi de oturumdan alınır. Başarıda { anket_id } döner; başarısız durumlarda
// backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse'ta güvenli jenerik).
export async function ekleAnket(govde) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let yanitGovdesi
  try {
    yanitGovdesi = await yanit.json()
  } catch {
    throw new Error(EKLE_HATA_MESAJI)
  }

  if (yanitGovdesi?.basari === true) {
    return { anket_id: yanitGovdesi.anket_id }
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(yanitGovdesi)) oturumGecersizYayinla()
  throw new Error(yanitGovdesi?.mesaj || EKLE_HATA_MESAJI)
}
