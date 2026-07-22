// Anket sorusu ekleme/düzenleme formunun SEÇENEK alanını, seçili soru tipinin
// moduna göre gösteren salt sunum bileşeni. SoruEkleForm'dan SRP gereği ayrılmıştır:
// yalnızca uygun seçenek yerleşimini gösterir ve girdiyi üst bileşene bildirir; iş
// kuralı/hesaplama İÇERMEZ (skalanın 5'li yapısını backend kurar; burada yalnız iki
// uç toplanır). Modlar:
//   'liste'      -> Seçenek Sayısı kadar zengin metin kartı (SoruMetniKart); bugünkü
//                   davranış aynen. Kart içerikleri HTML olarak üst state'te tutulur.
//   'evet_hayir' -> solda "Seçenekler" etiketi, karşısında düzenlenemez, bilgi amaçlı
//                   "Evet / Hayır" rozet önizlemesi (kullanıcı girdisi yok; gönderilecek
//                   sabiti backend/üst bileşen kurar).
//   'skala_5'    -> iki sade metin girişi: "1 için ifade" ve "5 için ifade" (uçlar).
//   'yok'        -> seçenek alanı HİÇ render edilmez (bu tipte şık girilmez; sunucu
//                   da şık kabul etmez, gövdeye boş liste gider).
// Görünüm için kullanici-ekle.css'teki mevcut form sınıfları paylaşılır (DRY).

import SoruMetniKart from './SoruMetniKart.jsx'

// seceneksHarfi: bir seçeneğin sıra indeksini gösterim harfine çevirir (0 -> A,
// 1 -> B, ...). YALNIZCA görsel etikettir; gönderilen dizinin sırasını/indeksini
// etkilemez. Seçenek Sayısı en çok 15 olduğundan A–O aralığında kalır (taşma yok).
function seceneksHarfi(indeks) {
  return String.fromCharCode(65 + indeks)
}

// SoruSecenekAlani: seçenek alanını moda göre render eder.
// props:
//   secenekModu        -> 'liste' | 'evet_hayir' | 'skala_5' | 'yok' (soruTipiSecenekModu)
//   secenekMetinleri   -> (liste) seçenek HTML metinleri dizisi
//   onSecenekMetniDegis-> (liste) (indeks, yeniHtml) => void; bir seçeneği günceller
//   skalaAltUc         -> (skala_5) "1 için ifade" metni
//   skalaUstUc         -> (skala_5) "5 için ifade" metni
//   onSkalaAltUcDegis  -> (skala_5) alt uç değişince çağrılır (yeniMetin => void)
//   onSkalaUstUcDegis  -> (skala_5) üst uç değişince çağrılır (yeniMetin => void)
function SoruSecenekAlani({
  secenekModu,
  secenekMetinleri,
  onSecenekMetniDegis,
  skalaAltUc,
  skalaUstUc,
  onSkalaAltUcDegis,
  onSkalaUstUcDegis,
}) {
  // yok: bu tipte (ör. yorum sorusu) şık girilmez; ne "Seçenekler" başlığı ne de bir
  // giriş alanı gösterilir. Üst bileşen gövdeye boş liste gönderir.
  if (secenekModu === 'yok') {
    return null
  }

  // evet_hayir: diğer tiplerle aynı satır düzeni kullanılır; solda 180px "Seçenekler"
  // etiketi, karşısında (sağda) sabit Evet/Hayır rozetleri durur. Sabitler yalnız bilgi
  // amaçlı gösterildiğinden kullanıcı girdisi ve zorunlu yıldızı yoktur; sabit-uyarı notu
  // altta kalır. Gönderilecek ["Evet","Hayır"] sabitini üst bileşen kurar (UI karar vermez).
  if (secenekModu === 'evet_hayir') {
    return (
      <div className="soru-ekle-secenekler-blok">
        <div className="soru-ekle-secenek-satiri">
          <span className="form-etiket soru-ekle-secenek-etiket">Seçenekler</span>
          <div className="soru-ekle-sabit-onizleme" aria-label="Sabit seçenekler">
            <span className="soru-ekle-sabit-rozet">Evet</span>
            <span className="soru-ekle-sabit-rozet">Hayır</span>
          </div>
        </div>
        <p className="kullanici-ekle-uyari">
          Bu soru tipinde seçenekler sabittir; değiştirilemez.
        </p>
      </div>
    )
  }

  // skala_5: yalnız iki uç ifade toplanır (kısa metin; sade input yeterli). Ara
  // noktaları (2,3,4) UI KURMAZ; backend ekler. Her iki uç da zorunludur.
  if (secenekModu === 'skala_5') {
    return (
      <div className="soru-ekle-secenekler-blok">
        <span className="form-etiket">
          Seçenekler <span className="zorunlu-yildiz">*</span>
        </span>
        <div className="soru-ekle-secenek-satiri">
          <span className="form-etiket soru-ekle-secenek-etiket">
            1 için ifade <span className="zorunlu-yildiz">*</span>
          </span>
          <input
            type="text"
            className="form-kutu"
            value={skalaAltUc}
            onChange={(olay) => onSkalaAltUcDegis(olay.target.value)}
            placeholder="Örn. Kesinlikle katılmıyorum"
          />
        </div>
        <div className="soru-ekle-secenek-satiri">
          <span className="form-etiket soru-ekle-secenek-etiket">
            5 için ifade <span className="zorunlu-yildiz">*</span>
          </span>
          <input
            type="text"
            className="form-kutu"
            value={skalaUstUc}
            onChange={(olay) => onSkalaUstUcDegis(olay.target.value)}
            placeholder="Örn. Kesinlikle katılıyorum"
          />
        </div>
      </div>
    )
  }

  // liste (varsayılan): Seçenek Sayısı kadar zengin metin kartı. Sayı seçilmediyse
  // (dizi boş) kart yerine yönlendirme ipucu gösterilir.
  return (
    <div className="soru-ekle-secenekler-blok">
      <span className="form-etiket">
        Seçenekler <span className="zorunlu-yildiz">*</span>
      </span>
      {secenekMetinleri.length === 0 ? (
        <p className="kullanici-ekle-uyari">Önce Seçenek Sayısı seçiniz</p>
      ) : (
        secenekMetinleri.map((secenekMetni, indeks) => (
          // Her seçenek satırı: solda 180px "Seçenek N" etiketi, sağda metin kartı;
          // etiket kartla dikey ortada hizalanır (yerleşim CSS'te). Kart kendi
          // başlığını göstermez (baslik verilmez).
          <div className="soru-ekle-secenek-satiri" key={indeks}>
            <span className="form-etiket soru-ekle-secenek-etiket">
              Seçenek {seceneksHarfi(indeks)}
            </span>
            <SoruMetniKart
              deger={secenekMetni ?? ''}
              onDegisim={(yeniHtml) => onSecenekMetniDegis(indeks, yeniHtml)}
              placeholder={`Seçenek ${seceneksHarfi(indeks)} metnini yazın`}
            />
          </div>
        ))
      )}
    </div>
  )
}

export default SoruSecenekAlani
