// Anket formunun "Anket Bilgileri" kartı: adı, ön/son yazı, açıklama, durum,
// anket tipi ve erişim seviyesi alanlarını gösterir ve girdi toplar. AnketEkleForm'dan
// ayrı dosyadadır çünkü tek bir işi vardır (bu bölümün alanlarını sunmak) ve form
// dosyası makul boyutta kalır (SRP). İş kuralı, hesaplama veya API çağrısı İÇERMEZ;
// değerleri üst bileşenden alır, değişiklikleri ona bildirir.
// Görünüm sınıfları kullanici-ekle.css + anket-ekle.css'ten paylaşılır (DRY).

import AnketKart from './AnketKart'
import {
  ANKET_TIPI_SECENEKLERI,
  DURUM_SECENEKLERI,
  ERISIM_SEVIYESI_SECENEKLERI,
} from '../common/anketFormAlanlari.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// AnketBilgileriKarti: anketin temel bilgi alanlarını render eder.
// props: form -> form state'i (yalnızca okunur); alanGuncelle(kimlik, deger) ->
//   tek alan değişimini üst bileşene bildirir.
function AnketBilgileriKarti({ form, alanGuncelle }) {
  return (
    <AnketKart baslik="Anket Bilgileri">
      <div className="kullanici-ekle-izgara">
        <label className="form-satir">
          <span className="form-etiket">
            Adı <span className="zorunlu-yildiz">*</span>
          </span>
          <input
            className="form-kutu"
            type="text"
            value={form.adi}
            onChange={(olay) => alanGuncelle('adi', olay.target.value)}
          />
        </label>

        <label className="form-satir">
          <span className="form-etiket">Ön Yazı</span>
          <input
            className="form-kutu"
            type="text"
            value={form.on_yazi}
            onChange={(olay) => alanGuncelle('on_yazi', olay.target.value)}
          />
        </label>

        <label className="form-satir">
          <span className="form-etiket">Son Yazı</span>
          <input
            className="form-kutu"
            type="text"
            value={form.son_yazi}
            onChange={(olay) => alanGuncelle('son_yazi', olay.target.value)}
          />
        </label>

        <label className="form-satir">
          <span className="form-etiket">Açıklama</span>
          <input
            className="form-kutu"
            type="text"
            value={form.aciklama}
            onChange={(olay) => alanGuncelle('aciklama', olay.target.value)}
          />
        </label>

        {/* Durum: radyo grubu; label sarmalayıcısı olmadan bir satır, seçenekler
            sağda daire olarak. Grup adı "anket-durum". */}
        <div className="form-satir">
          <span className="form-etiket">Durum</span>
          <div className="anket-radyo-grup">
            {DURUM_SECENEKLERI.map((secenek) => (
              <label key={secenek} className="anket-radyo-secenek">
                <input
                  type="radio"
                  name="anket-durum"
                  value={secenek}
                  checked={form.durum === secenek}
                  onChange={() => alanGuncelle('durum', secenek)}
                />
                <span>{secenek}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Anket Tipi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
            "anket-tipi". */}
        <div className="form-satir">
          <span className="form-etiket">
            Anket Tipi <span className="zorunlu-yildiz">*</span>
          </span>
          <div className="anket-radyo-grup anket-radyo-grup--tip">
            {ANKET_TIPI_SECENEKLERI.map((secenek) => (
              <label key={secenek} className="anket-radyo-secenek">
                <input
                  type="radio"
                  name="anket-tipi"
                  value={secenek}
                  checked={form.anket_tipi === secenek}
                  onChange={() => alanGuncelle('anket_tipi', secenek)}
                />
                <span>{secenek}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Erişim Seviyesi: tek dropdown; görünen cümle etikettir, sunucuya kısa
            kod (deger) gider. "Çalışma grubum..." seçilince grup ayrıca sorulmaz;
            sunucu oturum sahibinin kendi grubunu kullanır. */}
        <div className="form-satir">
          <span className="form-etiket">Erişim Seviyesi</span>
          <select
            className="form-kutu"
            value={form.erisim_seviyesi}
            onChange={(olay) => alanGuncelle('erisim_seviyesi', olay.target.value)}
            aria-label="Erişim seviyesi"
          >
            <option value="">Seçiniz</option>
            {ERISIM_SEVIYESI_SECENEKLERI.map((secenek) => (
              <option key={secenek.deger} value={secenek.deger}>
                {secenek.etiket}
              </option>
            ))}
          </select>
        </div>
      </div>
    </AnketKart>
  )
}

export default AnketBilgileriKarti
