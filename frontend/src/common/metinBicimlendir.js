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
