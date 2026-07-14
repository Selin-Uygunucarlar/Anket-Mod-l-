// Anket formunun "Sorular" kartı. AnketEkleForm'dan ayrı bir dosyada durur çünkü
// tek bir işi vardır: ankete eklenmiş soruları göstermek ve soru ekleme/kaldırma
// isteğini üst bileşene iletmek (SRP; form dosyası da makul boyutta kalır).
// Yalnızca sunum sorumluluğundadır: iş kuralı, hesaplama veya API çağrısı İÇERMEZ;
// soruların nereden geldiğine ve nasıl kaydedileceğine üst bileşen karar verir.
// Görünüm sınıfları anket-ekle.css'ten gelir (AnketKart ile aynı kart çerçevesi).

import AnketKart from './AnketKart'
import { soruTipiEtiketi } from '../common/soruTipleri.js'
import '../styles/anket-ekle.css'
// Soru metni gövdesi (.soru-metni-icerik) soru listesiyle aynı görünsün diye o
// stil dosyası paylaşılır; kopya kural yazılmaz (DRY).
import '../styles/soru-listesi.css'

// AnketSorulariKarti: seçili soruları sıra numarasıyla listeler; soru yoksa boş
// durum metnini gösterir.
// props: secilenSorular -> [{ soru_id, soru_metni, soru_tipi }] (sıra korunur);
//   onSoruSecmeyiAc() -> "Yüklemek için tıklayınız" tıklanınca çağrılır (üst bileşen
//   soru seçme ekranını yeni sekmede açar); onSoruKaldir(soruId) -> bir satırın
//   "Kaldır" butonu tıklanınca çağrılır.
function AnketSorulariKarti({ secilenSorular, onSoruSecmeyiAc, onSoruKaldir }) {
  return (
    <AnketKart
      baslik={
        <>
          Sorular <span className="zorunlu-yildiz">*</span>
        </>
      }
    >
      {/* "Excel ile yükle": bağlantı görünümlü, tamamen görsel; tıklama hiçbir şey
          yapmaz (bu fazın kapsamı dışında). */}
      <div className="anket-sorular-arac-cubugu">
        <button type="button" className="baglanti-buton">
          Excel ile yükle
        </button>
      </div>

      {secilenSorular.length === 0 ? (
        <p className="anket-bos-durum">
          Soru bulunmamaktadır.{' '}
          <button
            type="button"
            className="baglanti-buton"
            onClick={onSoruSecmeyiAc}
          >
            Yüklemek için tıklayınız
          </button>
        </p>
      ) : (
        <>
          <ol className="anket-secili-soru-listesi">
            {secilenSorular.map((soru) => (
              <li key={soru.soru_id} className="anket-secili-soru">
                <div className="anket-secili-soru-govde">
                  {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir; UI yeniden
                      sanitize etmez/işlemez (SoruListesi ile aynı kalıp). */}
                  <div
                    className="soru-metni-icerik"
                    dangerouslySetInnerHTML={{ __html: soru.soru_metni }}
                  />
                  <span className="anket-secili-soru-tip">
                    {soruTipiEtiketi(soru.soru_tipi)}
                  </span>
                </div>
                <button
                  type="button"
                  className="baglanti-buton"
                  onClick={() => onSoruKaldir(soru.soru_id)}
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ol>
          <p className="anket-bos-durum">
            Başka soru eklemek için{' '}
            <button
              type="button"
              className="baglanti-buton"
              onClick={onSoruSecmeyiAc}
            >
              tıklayınız
            </button>
          </p>
        </>
      )}
    </AnketKart>
  )
}

export default AnketSorulariKarti
