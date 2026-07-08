// Anket listesi filtre kartının paylaşılan seçenek ve başlangıç tanımları.
// AnketFiltre bileşeni buradan beslenir; sabitler tek yerde tutulur (DRY) ve
// bileşen dosyası sade kalır. Yalnızca sunum/girdi biçimlemesi içerir; iş kuralı,
// hesaplama veya doğrulama sınırı taşımaz (gerçek filtreleme ileride sunucuda).

// Oluşturulma tarih aralığı radyo seçenekleri (bu sırayla). Görünen metin (etiket)
// ile state'te tutulan değer (deger) FARKLI olduğundan { deger, etiket } nesne
// dizisi kullanılır. "son_1_hafta"/"son_1_ay" gibi seçimler için bugün veya aralık
// GERÇEK TARİH HESAPLANMAZ; yalnızca hangi seçeneğin seçildiği state'te tutulur
// (AnketEkleForm'daki tarih felsefesiyle aynı), hesap ileride servise bırakılır.
export const TARIH_ARALIGI_SECENEKLERI = [
  { deger: 'son_1_hafta', etiket: 'Son 1 Hafta' },
  { deger: 'son_1_ay', etiket: 'Son 1 Ay' },
  { deger: 'son_3_ay', etiket: 'Son 3 Ay' },
  { deger: 'son_1_yil', etiket: 'Son 1 Yıl' },
  { deger: 'tumu', etiket: 'Tümü' },
  { deger: 'tarih_sec', etiket: 'Tarih Seç' },
]

// Filtre kartının başlangıç değerleri: hiçbir filtre seçili değil (tüm alanlar boş).
// baslangic_tarih/bitis_tarih yalnızca tarih_araligi === 'tarih_sec' iken anlamlıdır
// (o zaman koşullu takvim girdileri görünür); diğer seçimlerde kullanılmaz.
export const BOS_ANKET_FILTRESI = {
  anket_tipi: '', // dropdown; boş = "Tümü" (placeholder)
  durum: '', // dropdown; boş = "Tümü" (placeholder)
  tarih_araligi: '', // radyo; TARIH_ARALIGI_SECENEKLERI degerlerinden biri
  baslangic_tarih: '', // yalnızca tarih_araligi === 'tarih_sec' iken anlamlı; <input type="date"> değeri
  bitis_tarih: '', // yalnızca tarih_araligi === 'tarih_sec' iken anlamlı; <input type="date"> değeri
}
