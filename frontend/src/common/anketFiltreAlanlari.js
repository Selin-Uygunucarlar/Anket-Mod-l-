// Anket listesi filtre kartının paylaşılan seçenek ve başlangıç tanımları.
// AnketFiltre bileşeni buradan beslenir; sabitler tek yerde tutulur (DRY) ve
// bileşen dosyası sade kalır. Yalnızca sunum/girdi biçimlemesi içerir; iş kuralı
// veya hesaplama taşımaz. Gerçek filtreleme (tarih aralığı hesabı, süzme) SUNUCUDA
// yapılır; buradaki uygulanacakFiltre yalnızca "eksik girdiyle istek atma" gösterim
// kuralını uygular (iş kuralı değildir).

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

// uygulanacakFiltre: kullanıcının seçtiği filtreden, sunucuya gönderilecek nihai
// filtre nesnesini türetir. Neden: "Tarih Seç" seçiliyken kullanıcı iki takvimi de
// doldurmadan yarım bir tarih filtresiyle istek atılmasın (eksik girdiyi gösterme
// katmanında ele alma). anket_tipi/durum/tarih_araligi doğrudan taşınır; yalnızca
// tarih_araligi === 'tarih_sec' iken VE iki tarih de doluysa tarihler (ve aralığın
// kendisi) dahil edilir, aksi halde üçü de dışlanır. Saf/yan etkisiz; iş kuralı değil.
export function uygulanacakFiltre(filtre) {
  const uygulanan = {
    anket_tipi: filtre.anket_tipi,
    durum: filtre.durum,
  }

  if (filtre.tarih_araligi === 'tarih_sec') {
    const baslangic = filtre.baslangic_tarih.trim()
    const bitis = filtre.bitis_tarih.trim()
    // Yalnızca iki tarih de doluysa tarih filtresini gönder; yarım girdiyi dışla.
    if (baslangic !== '' && bitis !== '') {
      uygulanan.tarih_araligi = 'tarih_sec'
      uygulanan.baslangic_tarih = baslangic
      uygulanan.bitis_tarih = bitis
    }
  } else {
    uygulanan.tarih_araligi = filtre.tarih_araligi
  }

  return uygulanan
}
