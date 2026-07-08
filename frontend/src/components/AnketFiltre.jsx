// Anket listesi filtre kartı. Anket listesinde arama satırı ile tablo arasında
// render edilir. ŞİMDİLİK yalnızca UI iskeletidir: gerçek filtreleme, API/servis
// veya tarih hesabı YOKTUR; yalnızca hangi filtrelerin seçildiği bileşenin kendi
// state'inde tutulur (AnketEkleForm'daki tarih seçimi felsefesiyle aynı). Yalnızca
// sunum sorumluluğundadır: filtre alanlarını gösterir ve seçim toplar. Anket Tipi
// ve Durum seçenekleri anketFormAlanlari.js'ten yeniden kullanılır (DRY); tarih
// aralığı seçenekleri anketFiltreAlanlari.js'ten gelir. BAŞLIKSIZ bir karttır.
// Yerleşim iki kolonludur: solda sabit genişlikli etiket sütunu, sağda kontrol
// sütunu; böylece tüm satırların kontrolleri aynı x'ten hizalanır.

import { useState } from 'react'
import {
  ANKET_TIPI_SECENEKLERI,
  DURUM_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import {
  TARIH_ARALIGI_SECENEKLERI,
  BOS_ANKET_FILTRESI,
} from '../common/anketFiltreAlanlari.js'
import '../styles/anket-filtre.css'

// AnketFiltre: anket listesi için başlıksız filtre kartını gösterir ve seçim toplar.
// Saf sunumdur; iş kuralı/veri çekimi/hesap içermez. Kendi state'ini tutar.
function AnketFiltre() {
  const [filtre, setFiltre] = useState(BOS_ANKET_FILTRESI)

  // alanGuncelle: tek bir filtre alanının değerini günceller (kontrollü girdiler).
  function alanGuncelle(kimlik, deger) {
    setFiltre((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  return (
    <section className="anket-filtre-kart" aria-label="Anket listesi filtreleri">
      {/* Satır: etiket sütunu (sol, renkli) | kontrol sütunu (sağ). İlk option
          value="" -> "Tümü" (placeholder), gerçek filtreleme YAPILMAZ. */}
      <label className="anket-filtre-satir">
        <span className="anket-filtre-etiket">Anket Tipi</span>
        <span className="anket-filtre-kontrol">
          <select
            className="anket-filtre-kutu"
            value={filtre.anket_tipi}
            onChange={(olay) => alanGuncelle('anket_tipi', olay.target.value)}
          >
            <option value="">Tümü</option>
            {ANKET_TIPI_SECENEKLERI.map((secenek) => (
              <option key={secenek} value={secenek}>
                {secenek}
              </option>
            ))}
          </select>
        </span>
      </label>

      <label className="anket-filtre-satir">
        <span className="anket-filtre-etiket">Durum</span>
        <span className="anket-filtre-kontrol">
          <select
            className="anket-filtre-kutu"
            value={filtre.durum}
            onChange={(olay) => alanGuncelle('durum', olay.target.value)}
          >
            <option value="">Tümü</option>
            {DURUM_SECENEKLERI.map((secenek) => (
              <option key={secenek} value={secenek}>
                {secenek}
              </option>
            ))}
          </select>
        </span>
      </label>

      {/* Oluşturulma tarih aralığı: etiket solda, radyo grubu sağdaki kontrol
          sütununda. Etiketle grup üstten hizalıdır çünkü radyolar sarınca çok
          satır olabilir. Grup adı "anket-filtre-tarih-araligi". Tarih HESAPLANMAZ. */}
      <div className="anket-filtre-satir">
        <span className="anket-filtre-etiket">Oluşturulma Tarih Aralığı</span>
        <div className="anket-filtre-kontrol">
          <div className="anket-filtre-radyo-grup">
            {TARIH_ARALIGI_SECENEKLERI.map((secenek) => (
              <label key={secenek.deger} className="anket-filtre-radyo-secenek">
                <input
                  type="radio"
                  name="anket-filtre-tarih-araligi"
                  value={secenek.deger}
                  checked={filtre.tarih_araligi === secenek.deger}
                  onChange={() => alanGuncelle('tarih_araligi', secenek.deger)}
                />
                <span>{secenek.etiket}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Yalnızca "Tarih Seç" işaretliyken ayrı bir satırda iki takvim girdisi
          (Başlangıç + Bitiş) KOŞULLU görünür. Sol etiket hücresi boş/hizalı kalır,
          kutular kontrol sütununun hizasından başlar. Gerçek aralık HESAPLANMAZ. */}
      {filtre.tarih_araligi === 'tarih_sec' && (
        <div className="anket-filtre-satir">
          <span className="anket-filtre-etiket anket-filtre-etiket-bos" aria-hidden="true" />
          <div className="anket-filtre-kontrol anket-filtre-tarih-satir">
            <label className="anket-filtre-alan">
              <span className="anket-filtre-etiket">Başlangıç</span>
              <input
                className="anket-filtre-kutu"
                type="date"
                value={filtre.baslangic_tarih}
                onChange={(olay) =>
                  alanGuncelle('baslangic_tarih', olay.target.value)
                }
              />
            </label>

            <label className="anket-filtre-alan">
              <span className="anket-filtre-etiket">Bitiş</span>
              <input
                className="anket-filtre-kutu"
                type="date"
                value={filtre.bitis_tarih}
                onChange={(olay) => alanGuncelle('bitis_tarih', olay.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </section>
  )
}

export default AnketFiltre
