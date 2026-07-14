// Yönetim menüsünün ağaç tanımı ve bu ağaçtan bir görünümün kırıntı yolunu
// (breadcrumb) çözen yardımcı. Hem admin panelinin menüyü çizmesi hem de içerik
// alanının "nereden geldim" yolunu göstermesi aynı tek kaynaktan beslensin diye
// burada toplanmıştır. Salt UI verisi/gezinmesidir; iş kuralı veya veri erişimi
// içermez.

// Panelde gösterilecek yönetim seçenekleri. altSecenekler taşıyan öğe, açılıp
// kapanabilen bir grup olarak render edilir. altSecenekler öğeleri ya düz string
// yapraklardır (işlevsiz yer tutucu) ya da kendi altSecenekler'i olan iç içe
// gruplardır ya da bir `gorunum` kimliği taşıyan işlevsel yapraklardır. gorunum
// taşıyan yaprak tıklanınca içerik alanında ilgili görünümü açar.
export const YONETIM_SECENEKLERI = [
  {
    baslik: 'Kullanıcı Yönetimi',
    altSecenekler: [
      {
        baslik: 'Kullanıcı Listeleri',
        altSecenekler: [
          { baslik: 'Kullanıcı Listesi', gorunum: 'kullanici-listesi' },
        ],
      },
      { baslik: 'Kullanıcı Grupları', gorunum: 'kullanici-gruplari' },
    ],
  },
  {
    baslik: 'Anketler',
    altSecenekler: [
      { baslik: 'Anket Listesi', gorunum: 'anket-listesi' },
      { baslik: 'Anket Soruları', gorunum: 'anket-sorulari' },
    ],
  },
  {
    baslik: 'Eğitim Yönetimi',
    altSecenekler: [
      'Eğitimler',
      'Etkinlikler',
      'Eğitim Kaynakları',
      'Sertifikaları',
    ],
  },
  { baslik: 'Raporlar' },
  {
    baslik: 'Ayarlar',
    altSecenekler: [
      { baslik: 'Kullanıcı Seçenek Tanımları', gorunum: 'ayarlar' },
      { baslik: 'Soru Seçenek Tanımları', gorunum: 'soru-ayarlar' },
      { baslik: 'Grup Tanımları', gorunum: 'grup-ayarlar' },
    ],
  },
]

// Menüde yer almayan, bir listeden açılan alt ekranlar. Yolları kendi başlarına
// bilinemediğinden hangi menü görünümünün altında durduklarıyla eşlenir.
// etiket, ilgili ekranın kendi başlığıyla birebir aynıdır.
const MENU_DISI_GORUNUMLER = {
  'kullanici-ekle': { ustGorunum: 'kullanici-listesi', etiket: 'Kullanıcı Ekle' },
  'kullanici-duzenle': {
    ustGorunum: 'kullanici-listesi',
    etiket: 'Kullanıcı Düzenle',
  },
  'soru-ekle': { ustGorunum: 'anket-sorulari', etiket: 'Anket Sorusu Ekleme' },
  'soru-duzenle': {
    ustGorunum: 'anket-sorulari',
    etiket: 'Anket Sorusu Düzenleme',
  },
  'anket-ekle': {
    ustGorunum: 'anket-listesi',
    etiket: 'Anket Oluşturma - Güncelleme',
  },
}

// araMenuYolunu: menü ağacında `gorunum` kimliği eşleşen yaprağı özyinelemeli
// arar; bulursa kökten yaprağa kadarki başlıkları dizi olarak, bulamazsa null
// döner. Düz string yapraklar görünüm taşımadığından atlanır.
function araMenuYolunu(secenekler, gorunumKimligi) {
  for (const secenek of secenekler) {
    if (typeof secenek === 'string') continue

    if (secenek.gorunum === gorunumKimligi) return [secenek.baslik]

    if (secenek.altSecenekler) {
      const altYol = araMenuYolunu(secenek.altSecenekler, gorunumKimligi)
      if (altYol) return [secenek.baslik, ...altYol]
    }
  }
  return null
}

// uyarCozulemeyenGorunum: yolu çözülemeyen bir görünümü yalnızca geliştirme
// modunda konsola bildirir. Kırıntı yolunun sessizce kaybolması fark edilmez bir
// eksiklik olduğundan, yeni bir görünüm menüye/tabloya eklenmeyi unutulduğunda
// geliştirici uyarılır. Üretimde ve kullanıcı arayüzünde hiçbir iz bırakmaz.
function uyarCozulemeyenGorunum(gorunumKimligi) {
  if (import.meta.env.DEV) {
    console.warn(
      `Kırıntı yolu çözülemedi: "${gorunumKimligi}". Bu görünüm menü ağacında veya MENU_DISI_GORUNUMLER tablosunda tanımlı değil.`,
    )
  }
}

// gorunumYolunuBul: bir görünüm kimliğinin kırıntı yolunu başlık dizisi olarak
// döner (ör. 'kullanici-listesi' -> ['Kullanıcı Yönetimi', 'Kullanıcı
// Listeleri', 'Kullanıcı Listesi']). Menüde olmayan alt ekranlar için üstünün
// yolunu bulup sonuna kendi etiketini ekler; böylece çağıran taraf tek bir
// fonksiyon çağırır. Yol çözülemezse boş dizi döner (çağıran hiçbir şey çizmez).
export function gorunumYolunuBul(gorunumKimligi) {
  // Görünüm seçilmemişse (boş anasayfa) yol olmaması normaldir, eksiklik değil.
  if (!gorunumKimligi) return []

  const menuYolu = araMenuYolunu(YONETIM_SECENEKLERI, gorunumKimligi)
  if (menuYolu) return menuYolu

  const menuDisiGorunum = MENU_DISI_GORUNUMLER[gorunumKimligi]
  if (!menuDisiGorunum) {
    uyarCozulemeyenGorunum(gorunumKimligi)
    return []
  }

  const ustYol = araMenuYolunu(YONETIM_SECENEKLERI, menuDisiGorunum.ustGorunum)
  if (!ustYol) {
    uyarCozulemeyenGorunum(gorunumKimligi)
    return []
  }

  return [...ustYol, menuDisiGorunum.etiket]
}
