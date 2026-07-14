// "Yeni sekmede seç -> açan sekmeye geri gönder" akışının paylaşılan parçaları.
// Anket formu artık üç ayrı seçme ekranı (soru / kullanıcı / grup) açtığından
// mesaj tipleri ve gönderim adımı tek yerde toplanır (DRY); aksi halde aynı
// postMessage + window.close kalıbı üç dosyada tekrarlanırdı. Yalnızca sunum
// katmanına aittir: iş kuralı, hesaplama veya API çağrısı İÇERMEZ. Sayfaların
// kendi tablo/durum gösterimi bilinçli olarak BİRLEŞTİRİLMEZ; her ekran farklı
// veriyi farklı kolonlarla gösterir.

// Açan sekmeye (anket formuna) gönderilen mesajların tipleri. Gönderen ekran ile
// dinleyen form aynı sabiti kullanır; form mesajları bu etikete göre ayırt eder
// (origin doğrulaması dinleyicide ayrıca yapılır).
export const SORU_SECIM_MESAJ_TIPI = 'anket-sorulari-secildi'
export const KULLANICI_SECIM_MESAJ_TIPI = 'anket-kullanicilari-secildi'
export const GRUP_SECIM_MESAJ_TIPI = 'anket-gruplari-secildi'

// acanSekmeVarMi: seçimin aktarılabileceği bir açan sekme (window.opener) olup
// olmadığını söyler. Kullanıcı seçme ekranının adresini doğrudan açtıysa hedef
// yoktur; ekran o durumda buton yerine bilgilendirme gösterir.
export function acanSekmeVarMi() {
  return Boolean(window.opener) && !window.opener.closed
}

// secimiAcanSekmeyeGonder: hazır seçim mesajını ({ tip, ... }) açan sekmeye
// iletir ve bu sekmeyi kapatır. Hedef origin KENDİ ORIGIN'imizdir ('*' değil):
// mesaj yalnızca aynı origin'deki sayfaya teslim edilir, başka sitelere sızmaz.
export function secimiAcanSekmeyeGonder(secimMesaji) {
  window.opener.postMessage(secimMesaji, window.location.origin)
  window.close()
}
