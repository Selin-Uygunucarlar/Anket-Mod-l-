// Kimlik doğrulama (auth) API erişim noktası — sunum katmanının backend'e
// bakan TEK yeri. UI bileşenleri doğrudan istek atmaz; buradaki fonksiyonu
// çağırır. Backend HTTP endpoint'i (POST /api/auth/login) burada bağlıdır;
// istek/yanıt şekli ~/Desktop/kontratlar.txt "HTTP / API Sınırı" ile birebir.

// Backend taban adresi. URL bir sır değildir; ortam değişkeni yoksa yerel
// geliştirme adresi varsayılan olarak kullanılır.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Kullanıcıya gösterilebilecek jenerik, güvenli hata mesajı (teknik detay yok).
const GENEL_HATA_MESAJI = 'Giriş yapılamadı. Lütfen tekrar deneyin.'

// login: kimlik (sicil kodu / e-posta) ve parolayı backend'e POST eder.
// Başarılıysa kullanıcı nesnesini döndürür; başarısızsa backend'in güvenli
// mesajını taşıyan bir Error fırlatır (React Query isError/onError tetiklenir).
// credentials:'include' zorunlu — oturum httpOnly cookie ile taşınır.
export async function login(kimlik, sifre) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kimlik, sifre }),
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
    return govde.kullanici
  }

  // basari:false — backend'in güvenli mesajını taşı; yoksa jenerik mesaj.
  throw new Error(govde?.mesaj || GENEL_HATA_MESAJI)
}

// me: mevcut httpOnly oturum cookie'siyle geçerli kullanıcıyı sorar.
// Geçerli oturum varsa kullanıcı nesnesini döndürür. Oturum yok/geçersiz
// (401 SESSION_INVALID) bir HATA DEĞİL, normal "giriş yapılmamış" durumudur;
// bu durumda null döner. Yalnızca ağ/parse sorununda güvenli Error fırlar.
export async function me() {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
    })
  } catch {
    // Ağ hatası — teknik detay sızdırmadan güvenli mesaj yükselt.
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    // Beklenmedik/parse edilemeyen yanıt: oturum çözümlenemedi say → null.
    return null
  }

  // Geçerli oturum → kullanıcı; aksi halde (401 dahil) giriş yapılmamış → null.
  return govde?.basari === true ? govde.kullanici : null
}

// sifreBelirle: geçici şifreyle giren kullanıcının kendi kalıcı şifresini
// belirlemesini backend'e iletir (kimlik oturum cookie'sinden okunur; kişi
// yalnızca kendi şifresini değiştirir, sahiplik sunucuda). Başarıda sessizce
// döner. Başarısızsa (ör. minimum uzunluk ihlali) backend'in güvenli mesajını
// taşıyan Error fırlar; ağ/parse hatasında da güvenli Error.
export async function sifreBelirle(yeniSifre) {
  let yanit
  try {
    yanit = await fetch(`${API_BASE}/api/auth/sifre-belirle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yeni_sifre: yeniSifre }),
      credentials: 'include',
    })
  } catch {
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }

  let govde
  try {
    govde = await yanit.json()
  } catch {
    throw new Error('Şifre belirlenemedi. Lütfen tekrar deneyin.')
  }

  if (govde?.basari === true) {
    return
  }

  // basari:false — backend'in güvenli mesajını taşı; yoksa jenerik mesaj.
  throw new Error(govde?.mesaj || 'Şifre belirlenemedi. Lütfen tekrar deneyin.')
}

// logout: sunucudaki oturumu sonlandırır (cookie sunucuda silinir).
// Gövde göndermez; kimlik cookie ile taşınır. Başarıda sessizce döner.
export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ağ hatası — çıkış istemci tarafında yine de tamamlanır; teknik detay
    // sızdırmadan güvenli mesaj yükselt (çağıran karar verir).
    throw new Error('Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin.')
  }
}
