// Anket sorusu ekleme/düzenleme formu. Anket soruları listesindeki "Yeni Soru
// Ekle" butonuyla (ekleme modu) veya bir satırın "Güncelle" butonuyla (düzenleme
// modu) anasayfa içerik alanında render edilir. Salt sunum sorumluluğundadır:
// alanları gösterir ve girdi toplar; iş kuralı, yetki veya hesaplama İÇERMEZ.
// Alanlar (her biri kendi UI state'inde): Soru Tipi (sabit liste), Seçenek Sayısı
// (2-15), Konu* ve Amaç* (yönetilen seçeneklerden gelir; ['secenekler'] sorgusuyla
// çekilip kategoriye göre gruplanır). Izgaranın altında Soru Metni* (tek zengin
// metin kartı) ve Seçenekler* (Seçenek Sayısı kadar zengin metin kartı) bulunur;
// bunların içeriği HTML olarak UI state'inde toplanır (SoruMetniKart kullanılır).
// Düzenleme modunda mevcut soru soruApi.soruDetayGetir ile çekilip alanlar
// ÖN-DOLDURULUR (KullaniciEkleForm düzenleme kalıbı). Zorunlu alanlar ZORUNLU
// işaretlidir (yalnızca görsel; asıl doğrulama sunucuda). KAYIT: "Kaydet"/"Güncelle"
// butonu, toplanan alanları eklemede soruApi.soruEkle ile POST /api/sorular,
// düzenlemede soruApi.soruGuncelle ile PUT /api/sorular/{soru_id} ucuna iletir
// (backend hazır). Zorunlu alanlar boşken buton yalnızca UX amaçlı pasiftir (basit
// presence guard; iş kuralı/karar sunucuda). Başarıda liste tazelenip listeye
// dönülür; hata durumunda backend'in güvenli mesajı gösterilir (teknik detay
// sızmaz). Görünüm sınıfları kullanici-ekle.css ile paylaşılır (DRY); yalnızca
// küçük yerleşim sınıfları eklenir.

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import { soruEkle, soruDetayGetir, soruGuncelle } from '../api/soruApi.js'
import { gruplaSeceneklerKategoriyeGore } from '../common/secenekKategorileri.js'
import { SORU_TIPLERI } from '../common/soruTipleri.js'
import SoruMetniKart from './SoruMetniKart.jsx'
import '../styles/kullanici-ekle.css'

// Seçenek Sayısı dropdown'ının değerleri: 2'den 15'e kadar. Tek yerde kullanıldığı
// için ayrı bir common dosyası yerine burada üretilir.
const SECENEK_SAYISI_SECENEKLERI = Array.from({ length: 14 }, (_, sira) => sira + 2)

// seceneksHarfi: bir seçeneğin sıra indeksini gösterim harfine çevirir (0 -> A,
// 1 -> B, ...). YALNIZCA görsel etikettir; gönderilen dizinin sırasını/indeksini
// etkilemez. Seçenek Sayısı en çok 15 olduğundan A–O aralığında kalır (taşma yok).
function seceneksHarfi(indeks) {
  return String.fromCharCode(65 + indeks)
}

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
  // Soru metni ve her bir seçeneğin metni HTML string olarak tutulur (SoruMetniKart
  // biçimlendirilmiş içerik üretir). Seçenekler dizisi, seçili Seçenek Sayısı kadar
  // eleman içerir; senkronizasyonu aşağıdaki useEffect yapar.
  const [soruMetni, setSoruMetni] = useState('')
  const [secenekMetinleri, setSecenekMetinleri] = useState([])

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

  // Detay geldiğinde formu bir kez mevcut değerlerle doldurur (düzenleme modu).
  // secenekMetinleri ile secenekSayisi aynı anda set edilir; secenekSayisi detay
  // uzunluğuna eşitlendiğinde yukarıdaki senkron useEffect zaten aynı uzunluğu
  // gördüğü için diziye dokunmaz (ön-doldurulan metinler korunur).
  useEffect(() => {
    if (!soruDetayi) {
      return
    }
    const seceneklerListesi = soruDetayi.secenekler ?? []
    setSoruTipi(soruDetayi.soru_tipi ?? '')
    setKonu(soruDetayi.konu ?? '')
    setAmac(soruDetayi.amac ?? '')
    setSoruMetni(soruDetayi.soru_metni ?? '')
    setSecenekMetinleri(seceneklerListesi.map((secenek) => secenek.secenek_metni ?? ''))
    setSecenekSayisi(String(seceneklerListesi.length))
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

  // zorunluAlanlarDolu: asteriskli zorunlu alanların (Soru Tipi, Konu, Amaç, Soru
  // Metni, Seçenekler) boş olup olmadığını denetleyen BASİT presence guard'ı.
  // Yalnızca Kaydet butonunu pasifleştirmek için (UX); iş kuralı/karar değildir,
  // asıl doğrulama sunucudadır.
  function zorunluAlanlarDolu() {
    const doluMu = (deger) => (deger ?? '').trim() !== ''
    if (!doluMu(soruTipi) || !doluMu(konu) || !doluMu(amac) || !doluMu(soruMetni)) {
      return false
    }
    if (secenekMetinleri.length === 0) {
      return false
    }
    return secenekMetinleri.every((metin) => doluMu(metin))
  }

  // handleGonder: formu gönderir. Zorunlu alanlar dolmadan buton pasif olduğundan
  // burada ek iş kuralı yoktur; kayıt isteği kontrat şekliyle API'ye iletilir.
  // secenekler dizisi olduğu gibi (sıra/indeks korunarak) gönderilir.
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
      secenekler: secenekMetinleri,
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

        {/* Seçenekler: dikey bir bölüm. En üstte tek satır "Seçenekler *" başlığı,
            altında Seçenek Sayısı kadar seçenek satırı alt alta dizilir. Her satırın
            "Seçenek N" etiketi, üstteki dropdown'ların etiketleriyle aynı 180px sol
            sütunda başlar. Sayı seçilmediyse (dizi boş) kart yerine yönlendirme ipucu
            gösterilir. */}
        <div className="soru-ekle-secenekler-blok">
          <span className="form-etiket">
            Seçenekler <span className="zorunlu-yildiz">*</span>
          </span>
          {secenekMetinleri.length === 0 ? (
            <p className="kullanici-ekle-uyari">Önce Seçenek Sayısı seçiniz</p>
          ) : (
            secenekMetinleri.map((secenekMetni, indeks) => (
              // Her seçenek satırı: solda 180px "Seçenek N" etiketi, sağda metin
              // kartı; etiket kartla dikey ortada hizalanır (yerleşim CSS'te). Kart
              // kendi başlığını göstermez (baslik verilmez).
              <div className="soru-ekle-secenek-satiri" key={indeks}>
                <span className="form-etiket soru-ekle-secenek-etiket">
                  Seçenek {seceneksHarfi(indeks)}
                </span>
                <SoruMetniKart
                  deger={secenekMetni ?? ''}
                  onDegisim={(yeniHtml) => guncelleSecenekMetni(indeks, yeniHtml)}
                  placeholder={`Seçenek ${seceneksHarfi(indeks)} metnini yazın`}
                />
              </div>
            ))
          )}
        </div>

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
