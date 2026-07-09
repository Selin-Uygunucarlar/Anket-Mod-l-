// Anket soruları API erişim noktası — sunum katmanının backend'e bakan TEK yeri.
// UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonları çağırır. Backend
// endpoint'leri (GET /api/sorular, DELETE /api/sorular/{soru_id}) burada bağlıdır;
// istek/yanıt şekli ~/Desktop/kontratlar.txt "ANKET SORULARI LİSTESİ" bloğuyla
// birebir. Oturum httpOnly cookie ile taşındığından credentials:'include' zorunludur.

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajları (teknik detay yok).
const LISTE_HATA_MESAJI = 'Sorular yüklenemedi. Lütfen tekrar deneyin.'
const SIL_HATA_MESAJI = 'Soru silinemedi. Lütfen tekrar deneyin.'
const AG_HATA_MESAJI = 'Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.'

// sorulariGetir: tüm anketlerin tüm sorularını backend'den çeker. Başarılıysa
// soru nesnelerinin dizisini (govde.sorular) döndürür; her sorunun soru_metni
// SUNUCUDA sanitize edilmiş HTML'dir. Başarısızsa backend'in güvenli mesajını
// (ör. 403 yetki, 401 oturum) taşıyan bir Error fırlatır. Ağ/parse hatasında da
// teknik detay sızdırmadan güvenli Error yükselir.
export async function sorulariGetir() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/sorular`, {
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

  // basari:false — backend'in güvenli mesajını taşı; yoksa jenerik mesaj.
  throw new Error(govde?.mesaj || LISTE_HATA_MESAJI)
}

// soruSil: verilen soru_id'ye ait soruyu siler (yalnızca admin; yetki sunucuda).
// Backend idempotenttir: kayıt yoksa da başarı döner; şıklar ve cevaplar DB'de
// birlikte silinir. Başarıda sessizce döner; başarısız durumlarda backend'in
// güvenli mesajını taşıyan Error fırlar (ağ/parse hatasında güvenli jenerik mesaj).
export async function soruSil(soruId) {
  let yanit
  try {
    yanit = await fetch(
      `${API_BASE}/api/sorular/${encodeURIComponent(soruId)}`,
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

  // basari:false — backend'in güvenli mesajını taşı; yoksa jenerik mesaj.
  throw new Error(govde?.mesaj || SIL_HATA_MESAJI)
}
