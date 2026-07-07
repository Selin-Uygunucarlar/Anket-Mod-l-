// Katmana bağlı olmayan, salt sunum (UI) metin biçimlendirme yardımcıları.
// Türkçe locale kurallarına uygun biçimlendirmeleri tek yerde toplar; birden
// çok bileşen aynı biçimlendirmeyi tekrar tanımlamasın (DRY). İş kuralı/karar
// içermez; yalnızca gösterim için metni dönüştürür.

// buyukHarfeCevir: metni Türkçe kurallarına uygun büyük harfe çevirir (i -> İ
// doğru olsun diye 'tr-TR' locale'i kullanılır). Boş/null değerde boş metin
// döner.
export function buyukHarfeCevir(metin) {
  if (!metin) {
    return ''
  }
  return metin.toLocaleUpperCase('tr-TR')
}

// tarihSaatBicimlendir: ISO 8601 tarih-saat metnini Türkçe okunur biçime
// (gün/ay/yıl saat:dk) çevirir. null/boş/geçersiz değerde tire ('-') döner.
// Sisteme eklenme, son giriş gibi zaman damgalarında kullanılır.
export function tarihSaatBicimlendir(isoMetin) {
  if (!isoMetin) {
    return '-'
  }
  const tarih = new Date(isoMetin)
  if (Number.isNaN(tarih.getTime())) {
    return '-'
  }
  return tarih.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// tarihBicimlendir: ISO 8601 tarih metnini yalnızca gün/ay/yıl olarak Türkçe
// okunur biçime çevirir (saat gösterilmez). null/boş/geçersiz değerde tire
// ('-') döner. İşe giriş tarihi gibi yalnız tarihli alanlarda kullanılır.
export function tarihBicimlendir(isoMetin) {
  if (!isoMetin) {
    return '-'
  }
  const tarih = new Date(isoMetin)
  if (Number.isNaN(tarih.getTime())) {
    return '-'
  }
  return tarih.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
