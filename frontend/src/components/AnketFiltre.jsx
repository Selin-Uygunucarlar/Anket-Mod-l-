// Anket listesi filtre kartı. Anket listesinde arama satırı ile tablo arasında
// render edilir. KONTROLLÜ bir bileşendir: kendi state'ini tutmaz; seçilen filtre
// değerlerini `filtre` propundan okur, her değişikliği `onFiltreDegis(kimlik, deger)`
// ile üst bileşene (AnketListesi) bildirir. Gerçek filtreleme SUNUCUDA yapılır;
// tarih aralığı hesabı UI'a KONMAZ. Yalnızca sunum sorumluluğundadır: filtre
// alanlarını gösterir ve seçim toplar. Anket Tipi ve Durum seçenekleri
// anketFormAlanlari.js'ten yeniden kullanılır (DRY); tarih aralığı seçenekleri
// anketFiltreAlanlari.js'ten gelir. BAŞLIKSIZ bir karttır. Yerleşim iki kolonludur:
// solda sabit genişlikli etiket sütunu, sağda kontrol sütunu; böylece tüm satırların
// kontrolleri aynı x'ten hizalanır.

import {
  ANKET_TIPI_SECENEKLERI,
  DURUM_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import { TARIH_ARALIGI_SECENEKLERI } from '../common/anketFiltreAlanlari.js'
import '../styles/anket-filtre.css'

// AnketFiltre: anket listesi için başlıksız filtre kartını gösterir ve seçim toplar.
// Saf sunumdur; iş kuralı/veri çekimi/hesap içermez.
// props: filtre (BOS_ANKET_FILTRESI şeklinde mevcut seçimler), onFiltreDegis(kimlik,
// deger) -> bir alan değişince üst bileşene haber verir (kontrollü bileşen).
function AnketFiltre({ filtre, onFiltreDegis }) {
  return (
    <section className="anket-filtre-kart" aria-label="Anket listesi filtreleri">
      {/* Satır: etiket sütunu (sol, renkli) | kontrol sütunu (sağ). İlk option
          value="" -> "Tümü" (placeholder); seçim sunucuya taşınır, süzme SUNUCUDA. */}
      <label className="anket-filtre-satir">
        <span className="anket-filtre-etiket">Anket Tipi</span>
        <span className="anket-filtre-kontrol">
          <select
            className="anket-filtre-kutu"
            value={filtre.anket_tipi}
            onChange={(olay) => onFiltreDegis('anket_tipi', olay.target.value)}
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
            onChange={(olay) => onFiltreDegis('durum', olay.target.value)}
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
          satır olabilir. Grup adı "anket-filtre-tarih-araligi". Tarih hesabı SUNUCUDA. */}
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
                  onChange={() => onFiltreDegis('tarih_araligi', secenek.deger)}
                />
                <span>{secenek.etiket}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Yalnızca "Tarih Seç" işaretliyken ayrı bir satırda iki takvim girdisi
          (Başlangıç + Bitiş) KOŞULLU görünür. Sol etiket hücresi boş/hizalı kalır,
          kutular kontrol sütununun hizasından başlar. Aralık hesabı SUNUCUDA; iki
          tarih de dolmadan istek atılmaz (bkz. uygulanacakFiltre). */}
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
                  onFiltreDegis('baslangic_tarih', olay.target.value)
                }
              />
            </label>

            <label className="anket-filtre-alan">
              <span className="anket-filtre-etiket">Bitiş</span>
              <input
                className="anket-filtre-kutu"
                type="date"
                value={filtre.bitis_tarih}
                onChange={(olay) => onFiltreDegis('bitis_tarih', olay.target.value)}
              />
            </label>
          </div>
        </div>
      )}
    </section>
  )
}

export default AnketFiltre
