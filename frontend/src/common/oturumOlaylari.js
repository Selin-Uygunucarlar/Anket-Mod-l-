// Oturum-geçersiz sinyalini API katmanıyla auth katmanı arasında gevşek bağlı
// taşıyan basit pub/sub. API fonksiyonları oturumun sunucuda sona erdiğini
// (SESSION_INVALID) fark edince olayı yayınlar; AuthContext buna abone olup
// istemci bağlamını temizler. Katmana bağımlı değildir, iş kuralı içermez.

// Olay dinleyicilerinin tutulduğu module-level küme.
const dinleyiciler = new Set()

// oturumGecersizAboneOl: verilen dinleyiciyi kaydeder ve abonelikten çıkış
// fonksiyonu döndürür (cleanup'ta çağrılarak dinleyici kaldırılır).
export function oturumGecersizAboneOl(dinleyici) {
  dinleyiciler.add(dinleyici)
  return () => {
    dinleyiciler.delete(dinleyici)
  }
}

// oturumGecersizYayinla: kayıtlı tüm dinleyicileri çağırır (oturum sunucuda
// sona erdiğinde tetiklenir).
export function oturumGecersizYayinla() {
  for (const dinleyici of dinleyiciler) {
    dinleyici()
  }
}

// oturumGecersizMi: backend hata gövdesinin oturum-geçersiz sinyalini taşıyıp
// taşımadığını söyler (kod === 'SESSION_INVALID').
export function oturumGecersizMi(govde) {
  return govde?.kod === 'SESSION_INVALID'
}
