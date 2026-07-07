// Salt sunum (UI) katmanı için girdi süzme yardımcıları. Kullanıcı yazarken
// anlık, nazik geri bildirim sağlar (ör. kod alanında yalnız rakam bırakmak).
// Bunlar bir güvenlik/doğrulama sınırı DEĞİLDİR; asıl doğrulama sunucudadır.
// İş kuralı içermez, yalnızca ham metni gösterim için süzer.

// sadeceRakam: metinden rakam-dışı tüm karakterleri ayıklar; geriye yalnızca
// 0-9 kalır. Kod alanlarında (kullanıcı kodu, ilgili yönetici kodu) kullanılır.
export function sadeceRakam(metin) {
  if (!metin) {
    return ''
  }
  return metin.replace(/\D/g, '')
}

// rakamlariAt: metindeki rakam karakterlerini kaldırır; harf, boşluk, tire ve
// kesme işareti gibi diğer karakterler korunur. Ad/soyad alanlarında rakam
// girişini engellemek için kullanılır (agresif filtreleme yapılmaz).
export function rakamlariAt(metin) {
  if (!metin) {
    return ''
  }
  return metin.replace(/[0-9]/g, '')
}
