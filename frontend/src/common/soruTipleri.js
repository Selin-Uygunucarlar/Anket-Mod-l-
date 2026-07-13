// Anket sorusu tiplerinin sabit tanımlarını tek yerde tutan sunum yardımcısı.
// SoruEkleForm'un "Soru Tipi" dropdown'ı buradan beslenir; SoruListesi ise ham
// kimliği (slug) kullanıcıya gösterilecek Türkçe etikete çevirmek için
// soruTipiEtiketi'ni kullanır. Her öğe stabil bir kimlik (slug), Türkçe etiket ve
// SoruEkleForm'un seçenek alanını hangi modda göstereceğini belirten secenekModu
// taşır (yalnız GÖSTERİM eşlemesi; iş kuralı/hesaplama içermez). secenekModu
// değerleri: 'evet_hayir' (sabit Evet/Hayır önizleme), 'skala_5' (iki uç ifade
// girişi), 'liste' (Seçenek Sayısı kadar zengin metin kartı). Kimlikler
// kayıt/servis akışında sabit kalacak şekilde seçilmiştir.

// SORU_TIPLERI: seçilebilen 7 soru tipi, gösterim sırasıyla. secenekModu, seçili
// tipe göre SoruEkleForm'un seçenek alanı yerleşimini belirler.
export const SORU_TIPLERI = [
  { kimlik: 'coktan_secmeli_tek', etiket: 'Çoktan seçmeli (tek yanıt)', secenekModu: 'liste' },
  { kimlik: 'coktan_secmeli_coklu', etiket: 'Çoktan seçmeli (çoklu yanıt)', secenekModu: 'liste' },
  { kimlik: 'evet_hayir', etiket: 'Evet-hayır sorusu', secenekModu: 'evet_hayir' },
  { kimlik: 'skala_5', etiket: "5'li skala sorusu", secenekModu: 'skala_5' },
  { kimlik: 'listeden_secmeli', etiket: 'Listeden seçmeli soru', secenekModu: 'liste' },
  { kimlik: 'yorum', etiket: 'Yorum sorusu', secenekModu: 'liste' },
  { kimlik: 'grid', etiket: 'Grid Sorusu', secenekModu: 'liste' },
]

// soruTipiEtiketi: bir soru tipi kimliğini (slug) kullanıcıya gösterilecek Türkçe
// etikete çevirir. Eşleşme yoksa veya kimlik boşsa ham kimliği döner; böylece
// eski/bilinmeyen tipler ekranda yine görünür (gösterim boşa düşmez).
export function soruTipiEtiketi(kimlik) {
  const eslesen = SORU_TIPLERI.find((tip) => tip.kimlik === kimlik)
  return eslesen ? eslesen.etiket : (kimlik ?? '')
}

// soruTipiSecenekModu: bir soru tipi kimliğini seçenek alanı moduna çevirir. Böylece
// SoruEkleForm hangi seçenek yerleşimini göstereceğine karar verir. Eşleşme yoksa
// veya kimlik boşsa 'liste' (varsayılan, bugünkü davranış) döner.
export function soruTipiSecenekModu(kimlik) {
  const eslesen = SORU_TIPLERI.find((tip) => tip.kimlik === kimlik)
  return eslesen ? eslesen.secenekModu : 'liste'
}
