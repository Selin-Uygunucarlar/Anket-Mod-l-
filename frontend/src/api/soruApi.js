// Anket soruları API erişim noktası — sunum katmanının backend'e bakan TEK yeri.
// UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonları çağırır. Backend
// endpoint'leri (GET /soru/get, POST /soru/post, GET /soru/get/{soru_id},
// PUT /soru/put/{soru_id}, DELETE /soru/delete/{soru_id}, GET
// /soru/get/sablon, POST /soru/post/toplu-yukle) burada bağlıdır;
// istek/yanıt şekli ~/Desktop/kontratlar.txt "ANKET SORULARI LİSTESİ", "ANKET
// SORUSU EKLEME" ve "ANKET SORUSU DETAY + GÜNCELLEME" bloklarıyla birebir. Oturum
// httpOnly cookie ile taşındığından credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Sorular yüklenemedi. Lütfen tekrar deneyin.'
const EKLE_HATA_MESAJI = 'Soru kaydedilemedi. Lütfen tekrar deneyin.'
const SIL_HATA_MESAJI = 'Soru silinemedi. Lütfen tekrar deneyin.'
const DETAY_HATA_MESAJI = 'Soru detayı yüklenemedi. Lütfen tekrar deneyin.'
const GUNCELLE_HATA_MESAJI = 'Soru güncellenemedi. Lütfen tekrar deneyin.'
const SABLON_HATA_MESAJI = 'Şablon indirilemedi. Lütfen tekrar deneyin.'
const TOPLU_YUKLE_HATA_MESAJI = 'Sorular yüklenemedi. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// sorulariGetir: tüm anketlerin tüm sorularını backend'den çeker. Başarılıysa
// soru nesnelerinin dizisini (govde.sorular) döndürür; her sorunun soru_metni
// SUNUCUDA sanitize edilmiş HTML'dir. Başarısızsa backend'in güvenli mesajını
// (ör. 403 yetki, 401 oturum) taşıyan bir Error fırlatır. Ağ/parse hatasında da
// teknik detay sızdırmadan güvenli Error yükselir.
export async function sorulariGetir() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/soru/get`, {
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
    return govde.sorular
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || LISTE_HATA_MESAJI)
}

// soruEkle: yeni bir bağımsız anket sorusunu backend'e kaydeder (yalnızca admin;
// yetki ve asıl doğrulama sunucuda). payload = { soru_tipi, konu, amac, soru_metni,
// secenekler } — secenekler HTML string dizisidir (sıra korunur; anket_id/hazirlayan
// gövdede GÖNDERİLMEZ, hazırlayan oturumdan alınır). Başarıda yeni soru_id döner;
// başarısız durumlarda backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse
// hatasında da teknik detay sızmadan güvenli jenerik mesaj).
export async function soruEkle(payload) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/soru/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    return govde.soru_id
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || EKLE_HATA_MESAJI)
}

// soruSil: verilen soru_id'ye ait soruyu siler (yalnızca admin; yetki sunucuda).
// Backend idempotenttir: kayıt yoksa da başarı döner; şıklar ve cevaplar DB'de
// birlikte silinir. Başarıda sessizce döner; başarısız durumlarda backend'in
// güvenli mesajını taşıyan Error fırlar (ağ/parse hatasında güvenli jenerik mesaj).
export async function soruSil(soruId) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/soru/delete/${encodeURIComponent(soruId)}`,
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

// soruDetayGetir: verilen soru_id'ye ait sorunun düzenleme için tüm alanlarını
// backend'den çeker (yalnızca admin; yetki sunucuda). Başarılıysa govde.soru
// nesnesini döndürür (soru_metni ve her secenek_metni SUNUCUDA sanitize edilmiş
// HTML'dir). Başarısızsa backend'in güvenli mesajını taşıyan Error fırlatır;
// ağ/parse hatasında da teknik detay sızdırmadan güvenli jenerik mesaj yükselir.
export async function soruDetayGetir(soruId) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/soru/get/${encodeURIComponent(soruId)}`,
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
    throw new Error(DETAY_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.soru
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || DETAY_HATA_MESAJI)
}

// soruGuncelle: verilen soru_id'ye ait soruyu backend'de günceller (yalnızca admin;
// yetki ve asıl doğrulama sunucuda). payload = { soru_tipi, konu, amac, soru_metni,
// secenekler } — POST /soru/post (ekleme) ile birebir aynı şekil; hazirlayan
// GÖNDERİLMEZ (güncellemede değişmez). Başarıda sessizce döner; başarısız durumlarda
// backend'in güvenli mesajını taşıyan Error fırlar (ağ/parse hatasında da güvenli
// jenerik mesaj).
export async function soruGuncelle(soruId, payload) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/soru/put/${encodeURIComponent(soruId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    throw new Error(GUNCELLE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || GUNCELLE_HATA_MESAJI)
}

// soruSablonuIndir: toplu yükleme için kullanılacak Excel şablonunu backend'den
// çeker (yalnızca admin; yetki sunucuda). Başarıda dosyanın ham içeriğini Blob
// olarak döndürür — dosyayı tarayıcıya indirtmek sunum işidir, çağıran bileşene
// aittir. Backend hata durumunda xlsx yerine JSON döndüğü için yanıtın içerik
// tipi denetlenir; hata yolunda backend'in güvenli mesajını taşıyan Error fırlar
// (ağ/parse hatasında da teknik detay sızmadan güvenli jenerik mesaj).
export async function soruSablonuIndir() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/soru/get/sablon`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  // Başarılı yanıt xlsx baytlarıdır (JSON değil); doğrudan Blob'a çevrilir.
  const icerikTipi = yanit.headers.get('Content-Type') ?? ''
  if (yanit.ok && !icerikTipi.includes('application/json')) {
    try {
      return await yanit.blob()
    } catch {
      throw new Error(SABLON_HATA_MESAJI)
    }
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(SABLON_HATA_MESAJI)
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || SABLON_HATA_MESAJI)
}

// sorulariExcelIleYukle: seçilen .xlsx dosyasını multipart gövdeyle backend'e
// gönderir ve soruları TOPLU ekletir (yalnızca admin; yetki, uzantı/boyut ve
// satır doğrulaması sunucuda). Alan adı backend'in beklediğiyle birebir aynıdır:
// 'dosya'. Content-Type başlığı ELLE verilmez; tarayıcı multipart sınırını (boundary)
// kendisi yazar. Başarıda eklenen soru sayısını döndürür. Başarısızsa backend'in
// güvenli mesajını taşıyan Error fırlar; yanıtta satır bazlı doğrulama hataları
// varsa (kullanıcının kendi verisine ait), bileşen tabloda gösterebilsin diye
// Error nesnesine `satirHatalari` olarak iliştirilir.
export async function sorulariExcelIleYukle(dosya) {
  const govdeVerisi = new FormData()
  govdeVerisi.append('dosya', dosya)

  let yanit
  try {
    yanit = await fetch(`${API_BASE}/soru/post/toplu-yukle`, {
      method: 'POST',
      body: govdeVerisi,
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error(TOPLU_YUKLE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.eklenen_sayisi
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  const hata = new Error(govde?.mesaj || TOPLU_YUKLE_HATA_MESAJI)
  if (Array.isArray(govde?.satir_hatalari)) {
    hata.satirHatalari = govde.satir_hatalari
  }
  throw hata
}
