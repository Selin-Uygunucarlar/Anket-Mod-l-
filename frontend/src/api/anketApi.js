// Anket API erişim noktası — sunum katmanının backend'e bakan TEK yeri. UI
// bileşenleri doğrudan istek atmaz; buradaki fonksiyonları çağırır. Backend
// endpoint'leri (GET /api/anketler, POST /api/anketler, GET /api/anketler/{id},
// PUT /api/anketler/{id}, GET /api/anketlerim, GET /api/anketler/{id}/doldur,
// POST /api/anketler/{id}/cevaplar) burada bağlıdır; istek/yanıt şekli
// ~/Desktop/kontratlar.txt "ANKET OLUŞTURMA + LİSTELEME (Faz 1)", "ANKET DETAY +
// GÜNCELLEME", "Ana ekran bekleyen anketler" ve "ANKET DOLDURMA (cevaplama)"
// bloklarıyla birebir. Anket yönetim uçları admin-only'dir; /api/anketlerim ve
// doldurma/cevaplama uçları ise her giriş yapmış kullanıcının KENDİ (kendisine
// atanmış) anketleri içindir (yetki sunucuda, sahiplik üzerinden). Oturum httpOnly
// cookie ile taşındığından tüm çağrılarda credentials:'include' zorunludur.

import { oturumGecersizMi, oturumGecersizYayinla } from '../common/oturumOlaylari.js'

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Anketler yüklenemedi. Lütfen tekrar deneyin.'
const ATANMIS_LISTE_HATA_MESAJI = 'Anketleriniz yüklenemedi. Lütfen tekrar deneyin.'
const EKLE_HATA_MESAJI = 'Anket kaydedilemedi. Lütfen tekrar deneyin.'
const DETAY_HATA_MESAJI = 'Anket bilgileri yüklenemedi. Lütfen tekrar deneyin.'
const GUNCELLE_HATA_MESAJI = 'Anket güncellenemedi. Lütfen tekrar deneyin.'
const DOLDUR_HATA_MESAJI = 'Anket yüklenemedi. Lütfen tekrar deneyin.'
const CEVAP_HATA_MESAJI = 'Cevaplarınız gönderilemedi. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// anketleriGetir: anketleri liste ekranı için backend'den çeker. filtreler, dolu
// olan alanları query parametresi olarak taşınan bir nesnedir (anket_tipi, durum,
// tarih_araligi, baslangic_tarih, bitis_tarih); boş/eksik alanlar URL'ye EKLENMEZ,
// hiç filtre yoksa çıplak /api/anketler istenir. Süzme SUNUCUDA yapılır; burası
// yalnızca seçimi taşır. Başarılıysa [{ anket_id, ad, durum, olusturan_ad,
// olusturan_soyad, olusturma_tarihi, atanan_sayisi, yanitlayan_sayisi }] dizisini
// döndürür. Başarısızsa backend'in güvenli mesajını (ör. 403 yetki, 401 oturum)
// taşıyan bir Error fırlatır; ağ/parse hatasında da teknik detay sızdırmadan güvenli
// Error yükselir.
export async function anketleriGetir(filtreler = {}) {
  // Yalnızca dolu (boş olmayan) alanlardan query string kur; boş alan eklenmez.
  const sorguParametreleri = new URLSearchParams()
  for (const [alan, deger] of Object.entries(filtreler)) {
    if (deger !== undefined && deger !== null && deger !== '') {
      sorguParametreleri.append(alan, deger)
    }
  }
  const sorguMetni = sorguParametreleri.toString()
  const url = sorguMetni ? `${API_BASE}/api/anketler?${sorguMetni}` : `${API_BASE}/api/anketler`

  let yanit
  try {
    yanit = await fetch(url, {
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

// atanmisAnketleriGetir: giriş yapan kullanıcıya atanmış, aktif ve henüz
// tamamlanmamış anketleri ana ekran paneli için backend'den çeker. Admin gerekmez;
// her kullanıcı KENDİ listesini alır (sicil sunucuda oturumdan çözülür, client'a
// güvenilmez). Başarılıysa [{ anket_id, ad }] dizisini döndürür (atama yoksa boş
// dizi). Başarısızsa backend'in güvenli mesajını taşıyan bir Error fırlatır; oturum
// sona erdiyse (SESSION_INVALID) sinyal yayılır. Ağ/parse hatasında da teknik detay
// sızdırmadan güvenli Error yükselir.
export async function atanmisAnketleriGetir() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketlerim`, {
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
    throw new Error(ATANMIS_LISTE_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.anketler
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || ATANMIS_LISTE_HATA_MESAJI)
}

// ekleAnket: yeni bir anketi backend'e kaydeder (yalnızca admin; yetki ve asıl
// doğrulama sunucuda). govde = { ad, on_yazi, son_yazi, aciklama, durum,
// anket_tipi, erisim_seviyesi, baslangic_secim, baslangic_tarih, bitis_secim,
// bitis_tarih, soru_idler, kullanici_kodlari, grup_idler }. Tarihler SUNUCUDA
// hesaplanır: UI yalnızca hangi seçeneğin seçildiğini (baslangic_secim/bitis_secim)
// taşır. kullanici_kodlari / grup_idler ankete KİMİN ATANACAĞIDIR: düz kimlik
// listesidir, boş liste geçerlidir (anket atamasız oluşur) ve erisim_seviyesi'nden
// bağımsızdır. olusturan_kodu ve erişim grubu GÖNDERİLMEZ; ikisi de oturumdan
// alınır. Başarıda { anket_id } döner; başarısız durumlarda backend'in güvenli
// mesajını taşıyan Error fırlar (ağ/parse'ta güvenli jenerik).
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

// anketDetayGetir: tek bir anketin düzenleme formunu doldurmak için tüm alanlarını
// backend'den çeker (yalnızca admin; "görebilen güncelleyebilir" kuralı sunucuda).
// Başarılıysa backend'in döndürdüğü anket nesnesini ({ anket_id, ad, on_yazi,
// son_yazi, aciklama, durum, anket_tipi, erisim_seviyesi, erisim_grup_id,
// baslangic_tarihi, bitis_tarihi, olusturan_kodu, bagli_sorular, atanan_kullanicilar })
// döndürür. Görünmüyor/yok (404), yetki (403) veya oturum (401) durumlarında
// backend'in güvenli mesajını taşıyan Error fırlatır; ağ/parse hatasında da teknik
// detay sızdırmadan güvenli Error yükselir.
export async function anketDetayGetir(anketId) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler/${anketId}`, {
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
    throw new Error(DETAY_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.anket
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || DETAY_HATA_MESAJI)
}

// guncelleAnket: var olan bir anketi backend'e güncellettirir (yalnızca admin;
// yetki ve asıl doğrulama sunucuda). govde = ekleAnket ile AYNI şekildedir
// ({ ad, on_yazi, son_yazi, aciklama, durum, anket_tipi, erisim_seviyesi,
// baslangic_secim, baslangic_tarih, bitis_secim, bitis_tarih, soru_idler,
// grup_idler, kullanici_kodlari }). erisim_grup_id ve olusturan_kodu GÖNDERİLMEZ;
// ikisi de sunucuda oturumdan/mevcut kayıttan çözülür. Atama farkı (kim eklenecek/
// çıkarılacak) da SUNUCUDA hesaplanır: frontend yalnızca istenen nihai listeleri
// taşır. Başarıda { } döner; başarısız durumlarda backend'in güvenli mesajını
// taşıyan Error fırlar (ağ/parse'ta güvenli jenerik).
export async function guncelleAnket(anketId, govde) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler/${anketId}`, {
      method: 'PUT',
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
    throw new Error(GUNCELLE_HATA_MESAJI)
  }

  if (yanitGovdesi?.basari === true) {
    return {}
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(yanitGovdesi)) oturumGecersizYayinla()
  throw new Error(yanitGovdesi?.mesaj || GUNCELLE_HATA_MESAJI)
}

// anketDoldurGetir: ankete ATANMIŞ kullanıcının anketi cevaplaması için sorularını
// (şıklarıyla) backend'den çeker. Admin gerekmez; yetki sunucuda SAHİPLİK üzerinden
// (anketin bu kullanıcıya atanmış olması) uygulanır; atanmamış/yok anket 404 döner.
// Başarılıysa backend'in döndürdüğü güvenli anket görünümünü ({ anket_id, ad,
// on_yazi, son_yazi, tamamlandi_mi, sorular: [{ soru_id, soru_metni, soru_tipi,
// zorunlu_mu, sira_no, secenekler: [{ secenek_id, secenek_metni, sira_no }] }] })
// döndürür; metinler sunucuda SANITIZE EDİLMİŞTİR. Bulunamadı (404), oturum (401)
// veya başka durumda backend'in güvenli mesajını taşıyan Error fırlatır; ağ/parse
// hatasında da teknik detay sızdırmadan güvenli Error yükselir.
export async function anketDoldurGetir(anketId) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler/${anketId}/doldur`, {
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
    throw new Error(DOLDUR_HATA_MESAJI)
  }

  if (govde?.basari === true) {
    return govde.anket
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(govde)) oturumGecersizYayinla()
  throw new Error(govde?.mesaj || DOLDUR_HATA_MESAJI)
}

// anketCevaplariGonder: kullanıcının anket cevaplarını TEK SEFERDE backend'e
// gönderir. cevaplar = [{ soru_id, secenek_idler: number[], cevap_metni: string|null }].
// Zorunluluk/kardinalite/aidiyet ve tarih/durum kuralları SUNUCUDA doğrulanır; burası
// yalnızca toplanan girdiyi taşır. Başarıda {} döner. Doğrulama (400), iş kuralı
// (409 — ör. zaten tamamlandı / pencere dışı), bulunamadı (404) veya oturum (401)
// durumlarında backend'in güvenli mesajını taşıyan Error fırlatır; ağ/parse hatasında
// da teknik detay sızdırmadan güvenli Error yükselir.
export async function anketCevaplariGonder(anketId, cevaplar) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/anketler/${anketId}/cevaplar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cevaplar }),
      credentials: 'include',
    })
  } catch {
    throw new Error(AG_HATA_MESAJI)
  }

  let yanitGovdesi
  try {
    yanitGovdesi = await yanit.json()
  } catch {
    throw new Error(CEVAP_HATA_MESAJI)
  }

  if (yanitGovdesi?.basari === true) {
    return {}
  }

  // basari:false — oturum sona erdiyse sinyal yay; her durumda güvenli mesajı taşı.
  if (oturumGecersizMi(yanitGovdesi)) oturumGecersizYayinla()
  throw new Error(yanitGovdesi?.mesaj || CEVAP_HATA_MESAJI)
}
