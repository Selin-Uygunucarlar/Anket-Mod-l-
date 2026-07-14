// Anket formunun "Kullanıcılar" kartı: ankete kimlerin atanacağını belirleyen
// seçenekleri gösterir. "Sabit liste" ve "Kullanıcı Grupları" checkbox'tır; İKİSİ
// DE aynı anda işaretlenebilir (bağımsız). Zorunlu değildir. Salt gösterimdir:
// gerçek atama/hesap YAPILMAZ ve bu seçimler SUNUCUYA GÖNDERİLMEZ; yalnızca seçim
// state'te tutulur, ileride atama akışına bağlanacaktır. AnketEkleForm'dan ayrı
// dosyadadır çünkü tek bir işi vardır (SRP; form dosyası makul boyutta kalır).
// Görünüm sınıfları anket-ekle.css'ten paylaşılır (DRY).

import AnketKart from './AnketKart'
import { KULLANICI_ATAMA_SECENEKLERI } from '../common/anketFormAlanlari.js'
import '../styles/anket-ekle.css'

// AnketKullanicilariKarti: atama seçeneklerinin checkbox grubunu render eder.
// props: seciliAtamalar -> işaretli seçenek degerleri dizisi;
//   onSecimDegistir(deger) -> bir seçeneğin işareti değişince çağrılır.
function AnketKullanicilariKarti({ seciliAtamalar, onSecimDegistir }) {
  return (
    <AnketKart baslik="Kullanıcılar">
      {/* Etiketsiz, dikey (alt alta) checkbox grubu: iki seçenek üst üste
          dizilir. Tek seçenek satırı (.anket-radyo-secenek) kalıbı korunur;
          yalnızca grup dikey yerleşim modifier'ıyla sütuna alınır. */}
      <div className="anket-radyo-grup anket-secenek-grup--dikey">
        {KULLANICI_ATAMA_SECENEKLERI.map((secenek) => (
          <label key={secenek.deger} className="anket-radyo-secenek">
            <input
              type="checkbox"
              name="kullanici-atama"
              value={secenek.deger}
              checked={seciliAtamalar.includes(secenek.deger)}
              onChange={() => onSecimDegistir(secenek.deger)}
            />
            <span>{secenek.etiket}</span>
          </label>
        ))}
      </div>
    </AnketKart>
  )
}

export default AnketKullanicilariKarti
