// Anket sorusu tiplerinin sabit tanımlarını tek yerde tutan sunum yardımcısı.
// SoruEkleForm'un "Soru Tipi" dropdown'ı buradan beslenir. Her öğe stabil bir
// kimlik (slug) ve kullanıcıya gösterilecek Türkçe etiket taşır; iş kuralı/karar
// içermez, yalnızca gösterim eşlemesidir. Kimlikler ileride kayıt/servis akışına
// bağlanınca sabit kalacak şekilde seçilmiştir.

// SORU_TIPLERI: seçilebilen 7 soru tipi, gösterim sırasıyla.
export const SORU_TIPLERI = [
  { kimlik: 'coktan_secmeli_tek', etiket: 'Çoktan seçmeli (tek yanıt)' },
  { kimlik: 'coktan_secmeli_coklu', etiket: 'Çoktan seçmeli (çoklu yanıt)' },
  { kimlik: 'evet_hayir', etiket: 'Evet-hayır sorusu' },
  { kimlik: 'skala_5', etiket: "5'li skala sorusu" },
  { kimlik: 'listeden_secmeli', etiket: 'Listeden seçmeli soru' },
  { kimlik: 'yorum', etiket: 'Yorum sorusu' },
  { kimlik: 'grid', etiket: 'Grid Sorusu' },
]
