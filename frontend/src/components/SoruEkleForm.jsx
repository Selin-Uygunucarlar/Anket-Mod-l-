// Anket sorusu ekleme/düzenleme formu. Anket soruları listesindeki "Yeni Soru
// Ekle" butonuyla (ekleme modu) veya bir satırın "Güncelle" butonuyla (düzenleme
// modu) anasayfa içerik alanında render edilir. Salt sunum sorumluluğundadır:
// alanları gösterir ve girdi toplar; iş kuralı, yetki veya hesaplama İÇERMEZ.
// Alanlar (her biri kendi UI state'inde): Soru Tipi (sabit liste), Konu* ve Amaç*
// (yönetilen seçeneklerden gelir; ['secenekler'] sorgusuyla çekilip kategoriye göre
// gruplanır). SEÇENEK alanı SORU TİPİNE GÖRE değişir (soruTipiSecenekModu):
//   'liste'      -> "Seçenek Sayısı" (2-15) dropdown'ı + o kadar zengin metin kartı
//                   (SoruMetniKart); içerik HTML olarak toplanır. Gönderilen
//                   secenekler = kart metinleri (bugünkü davranış).
//   'evet_hayir' -> Seçenek Sayısı/kartlar gizlenir; sabit "Evet / Hayır" önizlemesi
//                   gösterilir. Gönderilen secenekler = ["Evet","Hayır"].
//   'skala_5'    -> Seçenek Sayısı/kartlar gizlenir; iki uç ifade girişi (1 ve 5).
//                   Gönderilen secenekler = [skalaAltUc, skalaUstUc]; skalanın 5'li
//                   yapısını backend kurar (UI iki ucu toplar, hesaplama yapmaz).
//   'yok'        -> Seçenek Sayısı ve seçenek alanı HİÇ gösterilmez (ör. yorum sorusu).
//                   Gönderilen secenekler = [] (sunucu bu tipte şık kabul etmez).
//                   Başka bir tipte doldurulmuş seçenek state'i TEMİZLENMEZ, yalnızca
//                   gizlenir ve gövdeye konmaz; tipe geri dönülürse içerik korunur.
// Seçenek yerleşimi SoruSecenekAlani bileşenine ayrılmıştır (SRP). Soru Metni* her
// modda tek zengin metin kartıdır. Düzenleme modunda mevcut soru soruApi.soruDetayGetir
// ile çekilip alanlar tipe göre ÖN-DOLDURULUR (skala'da yalnız uçlar; ara noktalar yok
// sayılır). Zorunlu alanlar ZORUNLU işaretlidir (yalnızca görsel; asıl doğrulama
// sunucuda). KAYIT: "Kaydet"/"Güncelle" butonu, toplanan alanları eklemede
// soruApi.soruEkle ile POST /api/sorular, düzenlemede soruApi.soruGuncelle ile
// PUT /api/sorular/{soru_id} ucuna iletir (backend hazır; payload şekli her tipte
// aynı: { soru_tipi, konu, amac, soru_metni, secenekler }). Zorunlu alanlar boşken
// buton yalnızca UX amaçlı pasiftir (basit presence guard; iş kuralı/karar sunucuda).
// Başarıda liste tazelenip listeye dönülür; hata durumunda backend'in güvenli mesajı
// gösterilir (teknik detay sızmaz). Görünüm sınıfları kullanici-ekle.css ile
// paylaşılır (DRY); yalnızca küçük yerleşim sınıfları eklenir.

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import { soruEkle, soruDetayGetir, soruGuncelle } from '../api/soruApi.js'
import { gruplaSeceneklerKategoriyeGore } from '../common/secenekKategorileri.js'
import { SORU_TIPLERI, soruTipiSecenekModu } from '../common/soruTipleri.js'
import SoruSecenekAlani from './SoruSecenekAlani.jsx'
import SoruMetniKart from './SoruMetniKart.jsx'
import '../styles/kullanici-ekle.css'

// Seçenek Sayısı dropdown'ının değerleri: 2'den 15'e kadar. Tek yerde kullanıldığı
// için ayrı bir common dosyası yerine burada üretilir.
const SECENEK_SAYISI_SECENEKLERI = Array.from({ length: 14 }, (_, sira) => sira + 2)

// SoruEkleForm: anket sorusu ekleme/düzenleme alanlarını gösterir, girdi toplar ve
// Kaydet/Güncelle ile backend'e (soruApi.soruEkle veya soruApi.soruGuncelle) iletir.
// props: onGeriDon() -> "Geri Dön" tıklanınca ve başarılı kayıt sonrası çağrılır
// (üst bileşen listeye döner); duzenlenecekSoru -> verilirse düzenleme modu (en az
// soru_id taşıyan satır özeti); verilmezse ekleme modu (davranış aynen korunur).
function SoruEkleForm({ onGeriDon, duzenlenecekSoru }) {
  const duzenlemeModu = Boolean(duzenlenecekSoru)
  const [soruTipi, setSoruTipi] = useState('')
  const [secenekSayisi, setSecenekSayisi] = useState('5')
  const [konu, setKonu] = useState('')
  const [amac, setAmac] = useState('')
  // Soru metni ve (liste modunda) her seçeneğin metni HTML string olarak tutulur
  // (SoruMetniKart biçimlendirilmiş içerik üretir). Seçenekler dizisi, seçili Seçenek
  // Sayısı kadar eleman içerir; senkronizasyonu aşağıdaki useEffect yapar.
  const [soruMetni, setSoruMetni] = useState('')
  const [secenekMetinleri, setSecenekMetinleri] = useState([])
  // skala_5 modunun iki uç ifadesi (sade metin): "1 için ifade" ve "5 için ifade".
  // Ara noktaları (2,3,4) backend kurar; UI yalnız uçları toplar.
  const [skalaAltUc, setSkalaAltUc] = useState('')
  const [skalaUstUc, setSkalaUstUc] = useState('')

  // Seçili soru tipinin seçenek modu (liste/evet_hayir/skala_5/yok). Hangi seçenek
  // yerleşiminin gösterileceğini ve gönderilecek secenekler'in nasıl kurulacağını
  // belirler; iş kuralı değil, gösterim eşlemesidir.
  const secenekModu = soruTipiSecenekModu(soruTipi)

  // Seçenek Sayısı değiştikçe seçenek metni dizisini o uzunluğa getirir; hâlihazırda
  // yazılmış içerikleri korur (kısalırken baştakiler kalır, uzarken '' eklenir).
  // Uzunluk zaten eşitse aynı diziyi döndürerek gereksiz render/imleç sıçramasını önler.
  useEffect(() => {
    const secilenSayi = Number.parseInt(secenekSayisi, 10)
    const hedefUzunluk = Number.isNaN(secilenSayi) ? 0 : secilenSayi
    setSecenekMetinleri((oncekiler) => {
      if (oncekiler.length === hedefUzunluk) return oncekiler
      const yeniDizi = oncekiler.slice(0, hedefUzunluk)
      while (yeniDizi.length < hedefUzunluk) {
        yeniDizi.push('')
      }
      return yeniDizi
    })
  }, [secenekSayisi])

  // Düzenleme modunda mevcut sorunun tüm alanlarını backend'den çeker (satır özeti
  // konu/amac/seçenek metinlerini içermez). Yalnızca düzenleme modunda aktiftir.
  const {
    data: soruDetayi,
    isPending: detayYukleniyor,
    isError: detayHatasi,
    error: detayHataObjesi,
  } = useQuery({
    queryKey: ['soru-detay', duzenlenecekSoru?.soru_id],
    queryFn: () => soruDetayGetir(duzenlenecekSoru.soru_id),
    enabled: duzenlemeModu,
  })

  // Detay geldiğinde formu bir kez mevcut değerlerle doldurur (düzenleme modu),
  // seçenek alanını TİPE GÖRE doldurur:
  //   - liste: secenekMetinleri + secenekSayisi (secenekSayisi detay uzunluğuna
  //     eşitlendiğinde senkron useEffect aynı uzunluğu görüp diziye dokunmaz).
  //   - skala_5: stored secenekler [uc1,"2","3","4",uc5] gelir; yalnız ilk/son eleman
  //     kullanıcı uç ifadesidir, ara noktalar (2,3,4) YOK SAYILIR.
  //   - evet_hayir: kullanıcı girdisi yok (sabit); seçenek state'ine dokunulmaz.
  //   - yok: bu tipte şık gösterilmez; detaydan şık gelse bile seçenek state'ine
  //     dokunulmaz ve gövdeye şık konmaz.
  useEffect(() => {
    if (!soruDetayi) {
      return
    }
    const seceneklerListesi = soruDetayi.secenekler ?? []
    const tip = soruDetayi.soru_tipi ?? ''
    setSoruTipi(tip)
    setKonu(soruDetayi.konu ?? '')
    setAmac(soruDetayi.amac ?? '')
    setSoruMetni(soruDetayi.soru_metni ?? '')

    const mod = soruTipiSecenekModu(tip)
    if (mod === 'skala_5') {
      const ilkUc = seceneklerListesi[0]?.secenek_metni ?? ''
      const sonUc =
        seceneklerListesi.length > 0
          ? seceneklerListesi[seceneklerListesi.length - 1]?.secenek_metni ?? ''
          : ''
      setSkalaAltUc(ilkUc)
      setSkalaUstUc(sonUc)
    } else if (mod === 'liste') {
      setSecenekMetinleri(seceneklerListesi.map((secenek) => secenek.secenek_metni ?? ''))
      setSecenekSayisi(String(seceneklerListesi.length))
    }
  }, [soruDetayi])

  // guncelleSecenekMetni: belirtilen indeksteki seçeneğin HTML içeriğini günceller;
  // diziyi kopyalayıp yalnızca o indeksi değiştirir, diğer seçenekleri korur.
  function guncelleSecenekMetni(indeks, yeniHtml) {
    setSecenekMetinleri((oncekiler) => {
      const yeniDizi = oncekiler.slice()
      yeniDizi[indeks] = yeniHtml
      return yeniDizi
    })
  }

  // Yönetilen seçenekleri çeker; hata/yükleme durumunda dropdown'lar yalnızca
  // placeholder gösterir (teknik detay sızdırılmaz, KullaniciEkleForm kalıbı).
  const { data: secenekler } = useQuery({
    queryKey: ['secenekler'],
    queryFn: listSecenekler,
  })

  const gruplandirilmis = gruplaSeceneklerKategoriyeGore(secenekler)
  const konuSecenekleri = gruplandirilmis['konu'] ?? []
  const amacSecenekleri = gruplandirilmis['amac'] ?? []

  const queryClient = useQueryClient()

  // Kaydet/Güncelle isteği: toplanan alanları backend'e iletir. mutationFn moda göre
  // dallanır — düzenlemede soruGuncelle(soru_id, payload), eklemede soruEkle(payload).
  // Başarıda soru listesini (ve düzenlemede detay sorgularını) tazeler ve listeye
  // döner; teknik detay sızmaz.
  const kaydetMutation = useMutation({
    mutationFn: (payload) =>
      duzenlemeModu
        ? soruGuncelle(duzenlenecekSoru.soru_id, payload)
        : soruEkle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorular'] })
      if (duzenlemeModu) {
        queryClient.invalidateQueries({ queryKey: ['soru-detay'] })
      }
      onGeriDon()
    },
  })

  // zorunluAlanlarDolu: asteriskli zorunlu alanların boş olup olmadığını denetleyen
  // BASİT presence guard'ı; yalnızca Kaydet butonunu pasifleştirmek içindir (UX),
  // iş kuralı/karar değildir (asıl doğrulama sunucuda). Seçenek kontrolü TİPE göre:
  //   - evet_hayir: seçenekler sabit; ek kontrol yok.
  //   - yok: bu tipte şık girilmez; ek kontrol yok.
  //   - skala_5: her iki uç ifade de trim sonrası dolu olmalı.
  //   - liste: her seçenek kartı dolu olmalı (en az bir kart bulunmalı).
  function zorunluAlanlarDolu() {
    const doluMu = (deger) => (deger ?? '').trim() !== ''
    if (!doluMu(soruTipi) || !doluMu(konu) || !doluMu(amac) || !doluMu(soruMetni)) {
      return false
    }
    if (secenekModu === 'evet_hayir' || secenekModu === 'yok') {
      return true
    }
    if (secenekModu === 'skala_5') {
      return doluMu(skalaAltUc) && doluMu(skalaUstUc)
    }
    if (secenekMetinleri.length === 0) {
      return false
    }
    return secenekMetinleri.every((metin) => doluMu(metin))
  }

  // secenekleriTipeGoreKur: aktif seçenek moduna göre backend sözleşmesine uygun
  // secenekler dizisini üretir. UI iş kuralı/hesaplama YAPMAZ; yalnız aktif modun
  // topladığı değerleri iletir (skalanın 5'li yapısını backend kurar):
  //   - evet_hayir: sabit ["Evet","Hayır"] (2 eleman; sınır katmanı boş liste kabul etmez).
  //   - yok: boş liste (sunucu bu tipte şık kabul etmez); gizli kalan seçenek state'i
  //     gönderilmez.
  //   - skala_5: [skalaAltUc, skalaUstUc] (2 uç; backend ara noktaları ekler).
  //   - liste: seçenek kartı metinleri (sıra/indeks korunarak).
  function secenekleriTipeGoreKur() {
    if (secenekModu === 'evet_hayir') {
      return ['Evet', 'Hayır']
    }
    if (secenekModu === 'yok') {
      return []
    }
    if (secenekModu === 'skala_5') {
      return [skalaAltUc, skalaUstUc]
    }
    return secenekMetinleri
  }

  // handleGonder: formu gönderir. Zorunlu alanlar dolmadan buton pasif olduğundan
  // burada ek iş kuralı yoktur; kayıt isteği kontrat şekliyle API'ye iletilir.
  // secenekler moda göre kurulur (yalnız aktif modun alanları gönderilir).
  function handleGonder(olay) {
    olay.preventDefault()
    if (!zorunluAlanlarDolu()) {
      return
    }
    kaydetMutation.mutate({
      soru_tipi: soruTipi,
      konu,
      amac,
      soru_metni: soruMetni,
      secenekler: secenekleriTipeGoreKur(),
    })
  }

  // Düzenleme modunda mevcut soru çekilirken / çekilemezse uygun durum gösterilir.
  if (duzenlemeModu && detayYukleniyor) {
    return (
      <section className="kullanici-ekle">
        <p className="kullanici-liste-durum">Yükleniyor...</p>
      </section>
    )
  }
  if (duzenlemeModu && detayHatasi) {
    // detayHataObjesi.message backend'in güvenli mesajıdır; teknik detay sızmaz.
    return (
      <section className="kullanici-ekle">
        <div className="kullanici-ekle-hata" role="alert">
          {detayHataObjesi?.message ||
            'Soru detayı yüklenemedi. Lütfen tekrar deneyin.'}
        </div>
        <div className="kullanici-ekle-butonlar">
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </section>
    )
  }

  const kaydetPasif = !zorunluAlanlarDolu() || kaydetMutation.isPending
  const baslik = duzenlemeModu ? 'Anket Sorusu Düzenleme' : 'Anket Sorusu Ekleme'
  const kaydetButonMetni = duzenlemeModu
    ? kaydetMutation.isPending
      ? 'Güncelleniyor...'
      : 'Güncelle'
    : kaydetMutation.isPending
    ? 'Kaydediliyor...'
    : 'Kaydet'
  const kaydetHatasi = kaydetMutation.isError
    ? kaydetMutation.error?.message ||
      (duzenlemeModu
        ? 'Soru güncellenemedi. Lütfen tekrar deneyin.'
        : 'Soru kaydedilemedi. Lütfen tekrar deneyin.')
    : ''

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">{baslik}</h2>

      {/* Form gönderimi Kaydet ile POST /api/sorular'a gider; alanlar saf UI
          state'inde toplanır, gönderim ve doğrulama sunucuda tamamlanır. */}
      <form className="kullanici-ekle-form" onSubmit={handleGonder} noValidate>
        <div className="kullanici-ekle-izgara">
          <label className="form-satir">
            <span className="form-etiket">
              Soru Tipi <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={soruTipi}
              onChange={(olay) => setSoruTipi(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {SORU_TIPLERI.map((secenek) => (
                <option key={secenek.kimlik} value={secenek.kimlik}>
                  {secenek.etiket}
                </option>
              ))}
            </select>
          </label>

          {/* Seçenek Sayısı yalnız 'liste' modunda anlamlıdır; evet_hayir (sabit),
              skala_5 (iki uç) ve yok (şık girilmez) modlarında gizlenir. */}
          {secenekModu === 'liste' && (
            <label className="form-satir">
              <span className="form-etiket">Seçenek Sayısı</span>
              <select
                className="form-kutu"
                value={secenekSayisi}
                onChange={(olay) => setSecenekSayisi(olay.target.value)}
              >
                <option value="">Seçiniz</option>
                {SECENEK_SAYISI_SECENEKLERI.map((sayi) => (
                  <option key={sayi} value={sayi}>
                    {sayi}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-satir">
            <span className="form-etiket">
              Konu <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={konu}
              onChange={(olay) => setKonu(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {konuSecenekleri.map((deger) => (
                <option key={deger} value={deger}>
                  {deger}
                </option>
              ))}
            </select>
          </label>

          <label className="form-satir">
            <span className="form-etiket">
              Amaç <span className="zorunlu-yildiz">*</span>
            </span>
            <select
              className="form-kutu"
              value={amac}
              onChange={(olay) => setAmac(olay.target.value)}
            >
              <option value="">Seçiniz</option>
              {amacSecenekleri.map((deger) => (
                <option key={deger} value={deger}>
                  {deger}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Soru Metni: dış form-etiketiyle zorunlu işaretlenir; kart kendi başlığını
            göstermez (çift başlık olmaması için baslik verilmez). İçerik HTML. */}
        <div className="soru-ekle-metin-alani">
          <span className="form-etiket">
            Soru Metni <span className="zorunlu-yildiz">*</span>
          </span>
          <SoruMetniKart
            deger={soruMetni}
            onDegisim={setSoruMetni}
            placeholder="Soru metnini yazın"
          />
        </div>

        {/* Seçenek alanı seçili soru tipinin moduna göre değişir (liste kartları /
            sabit Evet-Hayır önizlemesi / iki uç ifade); 'yok' modunda hiç render
            edilmez. Yerleşim SoruSecenekAlani'da. */}
        <SoruSecenekAlani
          secenekModu={secenekModu}
          secenekMetinleri={secenekMetinleri}
          onSecenekMetniDegis={guncelleSecenekMetni}
          skalaAltUc={skalaAltUc}
          skalaUstUc={skalaUstUc}
          onSkalaAltUcDegis={setSkalaAltUc}
          onSkalaUstUcDegis={setSkalaUstUc}
        />

        {kaydetHatasi && (
          <div className="kullanici-ekle-hata" role="alert">
            {kaydetHatasi}
          </div>
        )}

        <div className="kullanici-ekle-butonlar">
          {/* Kaydet pasifken disabled buton hover almadığından tooltip'i saran
              span üzerinden gösterilir; buton aktifken data-uyari verilmez. */}
          <span
            className="kaydet-sarmalayici"
            data-uyari={kaydetPasif ? 'Lütfen zorunlu alanları doldurun' : undefined}
          >
            <button type="submit" className="birincil-buton" disabled={kaydetPasif}>
              {kaydetButonMetni}
            </button>
          </span>
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </form>
    </section>
  )
}

export default SoruEkleForm
