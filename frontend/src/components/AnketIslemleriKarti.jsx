// Anket formunun "İşlemler" kartı: üstte dört BAĞIMSIZ işlem checkbox'ı (birden
// çoğu aynı anda işaretlenebilir), altta ince ayırıcı çizgi, en altta soru gösterim
// biçimi için 3'lü radyo grubu (birbirini dışlar, varsayılan seçili). Salt
// gösterimdir: GERÇEK İŞLEV YOK ve bu seçimler SUNUCUYA GÖNDERİLMEZ; yalnızca
// seçimler state'te tutulur, ileride ilgili akışlara bağlanacaktır. AnketEkleForm'dan
// ayrı dosyadadır çünkü tek bir işi vardır (SRP; form dosyası makul boyutta kalır).
// Görünüm sınıfları anket-ekle.css'ten paylaşılır (DRY).

import AnketKart from './AnketKart'
import {
  ISLEM_SECENEKLERI,
  SORU_GOSTERIM_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import '../styles/anket-ekle.css'

// AnketIslemleriKarti: işlem checkbox'larını ve soru gösterim radyo grubunu render eder.
// props: seciliIslemler -> işaretli işlem degerleri dizisi; onIslemDegistir(deger) ->
//   bir işlem checkbox'ının işareti değişince çağrılır; soruGosterim -> seçili gösterim
//   biçimi degeri; onSoruGosterimDegis(deger) -> gösterim biçimi seçilince çağrılır.
function AnketIslemleriKarti({
  seciliIslemler,
  onIslemDegistir,
  soruGosterim,
  onSoruGosterimDegis,
}) {
  return (
    <AnketKart baslik="İşlemler">
      {/* Etiketsiz, dikey (alt alta) checkbox grubu; her seçenek bağımsızdır. */}
      <div className="anket-radyo-grup anket-secenek-grup--dikey">
        {ISLEM_SECENEKLERI.map((secenek) => (
          <label key={secenek.deger} className="anket-radyo-secenek">
            <input
              type="checkbox"
              name="anket-islem"
              value={secenek.deger}
              checked={seciliIslemler.includes(secenek.deger)}
              onChange={() => onIslemDegistir(secenek.deger)}
            />
            <span>{secenek.etiket}</span>
          </label>
        ))}
      </div>

      {/* İşlem checkbox'larını soru gösterim radyolarından ayıran ince çizgi. */}
      <div className="anket-tarih-ayirici" />

      {/* Soru gösterim biçimi: birbirini dışlayan 3'lü radyo grubu; uzun
          seçenekler alt alta okunsun diye dikey grup kalıbı kullanılır. */}
      <div className="anket-radyo-grup anket-secenek-grup--dikey">
        {SORU_GOSTERIM_SECENEKLERI.map((secenek) => (
          <label key={secenek.deger} className="anket-radyo-secenek">
            <input
              type="radio"
              name="soru-gosterim"
              value={secenek.deger}
              checked={soruGosterim === secenek.deger}
              onChange={() => onSoruGosterimDegis(secenek.deger)}
            />
            <span>{secenek.etiket}</span>
          </label>
        ))}
      </div>
    </AnketKart>
  )
}

export default AnketIslemleriKarti
