// Anket formunun "Tarihler" kartı: başlangıç ve bitiş tarihi seçimlerini gösterir
// ve girdi toplar. AnketEkleForm'dan ayrı dosyadadır çünkü tek bir işi vardır (bu
// bölümün alanlarını sunmak) ve form dosyası makul boyutta kalır (SRP).
// "Bugün"/"Yarın"/"Bir Ay"/"İki Ay" için UI'da TARİH HESAPLANMAZ: yalnızca hangi
// seçeneğin seçildiği forma yazılır; gerçek tarihi sunucudaki anket servisi
// hesaplar (hesaplama sunum katmanının işi değildir). "Tarih seç" işaretlenince
// takvim girdisi, o seçeneğin YANINDA (aynı satırda, sağında) koşullu render
// edilir; ayrı bir alt satırda değil. Görünüm sınıfları kullanici-ekle.css +
// anket-ekle.css'ten paylaşılır (DRY).

import { Fragment } from 'react'
import AnketKart from './AnketKart'
import {
  BASLANGIC_TARIHI_SECENEKLERI,
  BITIS_TARIHI_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// AnketTarihleriKarti: başlangıç ve bitiş tarihi radyo gruplarını (ve koşullu
// takvim girdilerini) render eder.
// props: form -> form state'i (yalnızca okunur); alanGuncelle(kimlik, deger) ->
//   tek alan değişimini üst bileşene bildirir.
function AnketTarihleriKarti({ form, alanGuncelle }) {
  return (
    <AnketKart baslik="Tarihler">
      {/* Başlangıç Tarihi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
          "baslangic-tarihi". Seçenekler mevcut radyo kalıbıyla üretilir (DRY).
          "Tarih seç" seçeneğinin yanında, seçiliyken takvim girdisi görünür. */}
      <div className="form-satir">
        <span className="form-etiket">
          Başlangıç Tarihi <span className="zorunlu-yildiz">*</span>
        </span>
        <div className="anket-radyo-grup">
          {BASLANGIC_TARIHI_SECENEKLERI.map((secenek) => (
            <Fragment key={secenek.deger}>
              <label className="anket-radyo-secenek">
                <input
                  type="radio"
                  name="baslangic-tarihi"
                  value={secenek.deger}
                  checked={form.baslangic_secim === secenek.deger}
                  onChange={() => alanGuncelle('baslangic_secim', secenek.deger)}
                />
                <span>{secenek.etiket}</span>
              </label>
              {/* Takvim yalnızca "Tarih seç" seçeneğinin yanında ve o seçim
                  işaretliyken görünür (koşullu render). */}
              {secenek.deger === 'tarih_sec' &&
                form.baslangic_secim === 'tarih_sec' && (
                  <input
                    className="form-kutu anket-tarih-secici"
                    type="date"
                    value={form.baslangic_tarih}
                    onChange={(olay) =>
                      alanGuncelle('baslangic_tarih', olay.target.value)
                    }
                  />
                )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Başlangıç ve Bitiş bölümlerini görsel olarak ayıran ince çizgi. */}
      <div className="anket-tarih-ayirici" />

      {/* Bitiş Tarihi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
          "bitis-tarihi". "Tarih seç" seçeneğinin yanında, seçiliyken takvim
          girdisi görünür. */}
      <div className="form-satir">
        <span className="form-etiket">
          Bitiş Tarihi <span className="zorunlu-yildiz">*</span>
        </span>
        <div className="anket-radyo-grup">
          {BITIS_TARIHI_SECENEKLERI.map((secenek) => (
            <Fragment key={secenek.deger}>
              <label className="anket-radyo-secenek">
                <input
                  type="radio"
                  name="bitis-tarihi"
                  value={secenek.deger}
                  checked={form.bitis_secim === secenek.deger}
                  onChange={() => alanGuncelle('bitis_secim', secenek.deger)}
                />
                <span>{secenek.etiket}</span>
              </label>
              {/* Takvim yalnızca "Tarih seç" seçeneğinin yanında ve o seçim
                  işaretliyken görünür (koşullu render). */}
              {secenek.deger === 'tarih_sec' &&
                form.bitis_secim === 'tarih_sec' && (
                  <input
                    className="form-kutu anket-tarih-secici"
                    type="date"
                    value={form.bitis_tarih}
                    onChange={(olay) =>
                      alanGuncelle('bitis_tarih', olay.target.value)
                    }
                  />
                )}
            </Fragment>
          ))}
        </div>
      </div>
    </AnketKart>
  )
}

export default AnketTarihleriKarti
