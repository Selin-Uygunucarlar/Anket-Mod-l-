// Yönetilen dropdown seçeneklerinin kategori tanımlarını tek yerde tutan sunum
// yardımcısı. Kategori kimlikleri backend sözleşmesiyle (kontratlar.txt) birebir
// aynıdır; Türkçe etiketler yalnızca gösterim içindir. Hem KullaniciEkleForm'un
// dropdown başlıkları hem AyarlarSayfasi'nın kategori seçimi/listesi buradan
// beslenir (DRY). İş kuralı/karar içermez; yalnızca gösterim eşlemesi ve gruplama.

// SECENEK_KATEGORILERI: 10 dropdown kategorisi, gösterim sırasıyla. Her öğe bir
// kategori kimliği (backend ile birebir) ve kullanıcıya gösterilecek Türkçe
// etiket taşır. Bu dizi hem sıralamayı hem etiketleri tek kaynaktan sağlar.
export const SECENEK_KATEGORILERI = [
  { kimlik: 'sirket', etiket: 'Şirket' },
  { kimlik: 'grup', etiket: 'Grup' },
  { kimlik: 'bolum', etiket: 'Bölüm' },
  { kimlik: 'birim', etiket: 'Birim' },
  { kimlik: 'kadro_grubu', etiket: 'Kadro Grubu' },
  { kimlik: 'kadro_unvani', etiket: 'Kadro Ünvanı' },
  { kimlik: 'gorev_unvani', etiket: 'Görev Ünvanı' },
  { kimlik: 'arge_personeli', etiket: 'Arge Personeli' },
  { kimlik: 'personel_sigorta_is_yeri', etiket: 'Personel Sigorta İş Yeri' },
  { kimlik: 'gorev_yeri', etiket: 'Görev Yeri' },
]

// gruplaSeceneklerKategoriyeGore: backend'den düz gelen [{kategori, deger}]
// listesini { [kategori]: [deger, ...] } biçiminde gruplar. Bilinmeyen kategori
// gelirse yok sayılmaz; kendi anahtarında toplanır. Saf gösterim dönüşümüdür.
export function gruplaSeceneklerKategoriyeGore(secenekler) {
  const gruplar = {}
  for (const secenek of secenekler ?? []) {
    if (!gruplar[secenek.kategori]) {
      gruplar[secenek.kategori] = []
    }
    gruplar[secenek.kategori].push(secenek.deger)
  }
  return gruplar
}
