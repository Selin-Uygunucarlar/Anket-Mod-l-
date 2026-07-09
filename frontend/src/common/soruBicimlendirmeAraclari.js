// Soru metni zengin biçimlendirme kartının (SoruMetniKart) araç çubuğu sabitleri.
// Bileşen buradan beslenir; komut/etiket tanımları tek yerde tutulur (DRY) ve
// bileşen dosyası ince kalır. Yalnızca SUNUM sabitleridir: hangi butonun hangi
// document.execCommand komutunu tetikleyeceğini ve font boyutu seçeneklerini
// tanımlar. İş kuralı, hesaplama veya doğrulama İÇERMEZ.

// Temel metin biçim komutları (bu sırayla): kalın, italik, altı çizili. Her öğe
// { komut, etiket, ipucu } taşır; komut doğrudan execCommand'a geçirilir, etiket
// buton üzerinde görünür, ipucu erişilebilirlik/title içindir.
export const METIN_BICIM_KOMUTLARI = [
  { komut: 'bold', etiket: 'K', ipucu: 'Kalın' },
  { komut: 'italic', etiket: 'İ', ipucu: 'İtalik' },
  { komut: 'underline', etiket: 'A', ipucu: 'Altı çizili' },
]

// Liste komutları (bu sırayla): madde listesi ve numaralı liste. Aynı
// { komut, etiket, ipucu } kalıbı kullanılır.
export const LISTE_KOMUTLARI = [
  { komut: 'insertUnorderedList', etiket: '• Liste', ipucu: 'Madde listesi' },
  { komut: 'insertOrderedList', etiket: '1. Liste', ipucu: 'Numaralı liste' },
]

// Hizalama komutları (bu sırayla): sola, ortaya, sağa. Aynı { komut, etiket, ipucu }
// kalıbı kullanılır.
export const HIZALAMA_KOMUTLARI = [
  { komut: 'justifyLeft', etiket: 'Sola', ipucu: 'Sola hizala' },
  { komut: 'justifyCenter', etiket: 'Ortaya', ipucu: 'Ortaya hizala' },
  { komut: 'justifyRight', etiket: 'Sağa', ipucu: 'Sağa hizala' },
]

// Font boyutu dropdown seçenekleri (bu sırayla). execCommand('fontSize') 1-7
// aralığında değer aldığından deger bu ölçeğe göre verilir; etiket kullanıcıya
// anlaşılır adı gösterir. Varsayılan seçenek "Normal"dir (deger '3').
export const FONT_BOYUTU_SECENEKLERI = [
  { deger: '2', etiket: 'Küçük' },
  { deger: '3', etiket: 'Normal' },
  { deger: '5', etiket: 'Büyük' },
  { deger: '7', etiket: 'Çok Büyük' },
]

// Font boyutu dropdown'ının başlangıç değeri (execCommand fontSize ölçeğinde
// "Normal"). Seçim yapıldığında geçici olarak seçili metne uygulanır.
export const VARSAYILAN_FONT_BOYUTU = '3'
