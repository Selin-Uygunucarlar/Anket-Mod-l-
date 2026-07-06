// Kullanıcı yönetimi API erişim noktası — sunum katmanının backend'e bakan
// TEK yeri. UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonu çağırır.
// Backend HTTP endpoint'i (GET /api/kullanicilar) burada bağlıdır; istek/yanıt
// şekli ~/Desktop/kontratlar.txt "KULLANICI LİSTESİ ÖZELLİĞİ" ile birebir.
// Oturum httpOnly cookie ile taşındığından credentials:'include' zorunludur.

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

  // basari:false — backend'in güvenli mesajını taşı; yoksa jenerik mesaj.
  throw new Error(govde?.mesaj || GENEL_HATA_MESAJI)
}
