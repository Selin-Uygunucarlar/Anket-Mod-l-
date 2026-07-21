// Yönetim menüsünün ağaç tanımı, bu ağaçtan bir görünümün kırıntı yolunu
// (breadcrumb) çözen yardımcılar ve görünüm kimliği ile gerçek URL yolu arasındaki
// TEK KAYNAK eşleme. Hem admin panelinin menüyü çizmesi/URL'ye gezinmesi hem de
// içerik alanının aktif URL'den "nereden geldim" yolunu göstermesi aynı tek
// kaynaktan beslensin diye burada toplanmıştır. Kırıntı yolu iki biçimde çözülür:
// gorunumYolunuBul yalnızca başlık dizisi, gorunumYolunuBulDetayli ise her segmentin
// hedefini de ({ baslik, gorunum }) döner (tıklanabilir kırıntı yolu için). Salt UI
// verisi/gezinmesidir; iş kuralı veya veri erişimi içermez.

import { matchPath } from 'react-router-dom'

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
  'anket-duzenle': {
    ustGorunum: 'anket-listesi',
    etiket: 'Anket Güncelle',
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

// araMenuYoluDetayli: menü ağacında `gorunum` kimliği eşleşen yaprağı özyinelemeli
// arar; bulursa kökten yaprağa kadarki her düğümü { baslik, gorunum } olarak döner
// (grup düğümlerinde gorunum null, işlevsel yaprakta gerçek kimlik), bulamazsa null.
// araMenuYolunu'nun detaylı kardeşidir: başlığın yanında segmentin hedefini de taşır
// ki kırıntı yolu sayfa taşıyan segmentleri tıklanabilir çizebilsin.
function araMenuYoluDetayli(secenekler, gorunumKimligi) {
  for (const secenek of secenekler) {
    if (typeof secenek === 'string') continue

    if (secenek.gorunum === gorunumKimligi) {
      return [{ baslik: secenek.baslik, gorunum: secenek.gorunum }]
    }

    if (secenek.altSecenekler) {
      const altYol = araMenuYoluDetayli(secenek.altSecenekler, gorunumKimligi)
      if (altYol) {
        return [{ baslik: secenek.baslik, gorunum: secenek.gorunum ?? null }, ...altYol]
      }
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

// gorunumYolunuBulDetayli: gorunumYolunuBul'un detaylı karşılığı; başlık dizisi
// yerine her segmenti { baslik, gorunum } olarak döner. Grup düğümleri gorunum:null
// (tıklanamaz) taşırken sayfa taşıyan segmentler kendi gorunum kimliğini taşır.
// Menüde olmayan alt ekranlarda üst yol segmentleri kendi kimliğini taşır; son segment
// (bulunulan ekran) gorunum:null olur (kendi sayfasına gitmek anlamsızdır). Yol
// çözülemezse boş dizi döner (çağıran hiçbir şey çizmez) — gorunumYolunuBul ile aynı
// çözümleme ve aynı uyarı kullanılır.
export function gorunumYolunuBulDetayli(gorunumKimligi) {
  // Görünüm seçilmemişse (boş anasayfa) yol olmaması normaldir, eksiklik değil.
  if (!gorunumKimligi) return []

  const menuYolu = araMenuYoluDetayli(YONETIM_SECENEKLERI, gorunumKimligi)
  if (menuYolu) return menuYolu

  const menuDisiGorunum = MENU_DISI_GORUNUMLER[gorunumKimligi]
  if (!menuDisiGorunum) {
    uyarCozulemeyenGorunum(gorunumKimligi)
    return []
  }

  const ustYol = araMenuYoluDetayli(YONETIM_SECENEKLERI, menuDisiGorunum.ustGorunum)
  if (!ustYol) {
    uyarCozulemeyenGorunum(gorunumKimligi)
    return []
  }

  return [...ustYol, { baslik: menuDisiGorunum.etiket, gorunum: null }]
}

// GORUNUM_ROTA_ESLEMESI: her yönetim görünümü kimliğini gerçek URL yol kalıbıyla
// eşleyen TEK kaynak. Düzenleme ekranlarının kalıbı :param taşır (ör. :sicil);
// gezinme için gorunumUrl, aktif URL'den kimlik çözmek için yoldanGorunumBul
// buradan beslenir. Yeni bir yönetim ekranı = buraya tek bir satır eklemek.
export const GORUNUM_ROTA_ESLEMESI = [
  { gorunum: 'kullanici-listesi', yol: '/yonetim/kullanicilar' },
  { gorunum: 'kullanici-ekle', yol: '/yonetim/kullanicilar/ekle' },
  { gorunum: 'kullanici-duzenle', yol: '/yonetim/kullanicilar/:sicil/duzenle' },
  { gorunum: 'kullanici-gruplari', yol: '/yonetim/kullanici-gruplari' },
  { gorunum: 'anket-listesi', yol: '/yonetim/anketler' },
  { gorunum: 'anket-ekle', yol: '/yonetim/anketler/ekle' },
  { gorunum: 'anket-duzenle', yol: '/yonetim/anketler/:anketId/duzenle' },
  { gorunum: 'anket-sorulari', yol: '/yonetim/sorular' },
  { gorunum: 'soru-ekle', yol: '/yonetim/sorular/ekle' },
  { gorunum: 'soru-duzenle', yol: '/yonetim/sorular/:soruId/duzenle' },
  { gorunum: 'ayarlar', yol: '/yonetim/ayarlar/kullanici-secenekleri' },
  { gorunum: 'soru-ayarlar', yol: '/yonetim/ayarlar/soru-secenekleri' },
  { gorunum: 'grup-ayarlar', yol: '/yonetim/ayarlar/grup-tanimlari' },
]

// gorunumUrl: bir görünüm kimliğinin (ör. 'kullanici-listesi') gerçek URL yolunu
// döner. Admin paneli bir menü yaprağı seçildiğinde bu yola gezinmek için kullanır.
// Panel yaprakları parametresiz ekranlardır; eşleme bulunamazsa güvenli varsayılan
// olarak ana ekran ('/') döner (sessiz kayıp yerine bilinen bir hedef).
export function gorunumUrl(gorunumKimligi) {
  const eslesme = GORUNUM_ROTA_ESLEMESI.find(
    (kayit) => kayit.gorunum === gorunumKimligi,
  )
  return eslesme ? eslesme.yol : '/'
}

// yoldanGorunumBul: aktif URL yolundan (ör. '/yonetim/kullanicilar/42/duzenle')
// eşleşen görünüm kimliğini çözer. Parametrik yollar da eşleşsin diye react-router
// matchPath kullanılır. Kırıntı yolu, aktif URL'yi tek başlık dizisine çevirmek
// için bu kimliği gorunumYolunuBul'a verir. Eşleşme yoksa (ör. ana ekran) null döner.
export function yoldanGorunumBul(aktifYol) {
  const eslesme = GORUNUM_ROTA_ESLEMESI.find((kayit) =>
    matchPath(kayit.yol, aktifYol),
  )
  return eslesme ? eslesme.gorunum : null
}
