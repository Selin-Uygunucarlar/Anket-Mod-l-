// Kırıntı yolu (breadcrumb) bileşeni. İçerik alanının üstünde, kullanıcının
// menüde hangi dalın altında olduğunu "Kullanıcı Yönetimi › Kullanıcı Listeleri
// › Kullanıcı Listesi" biçiminde tek satır olarak gösterir. Bir sayfaya karşılık
// gelen (gorunum taşıyan) ve son olmayan segmentler tıklanabilir bağlantı olarak
// çizilir; grup başlıkları ve bulunulan sayfa (son segment) tıklanamaz düz metindir.
// Salt gösterim/gezinme sorumluluğundadır; iş kuralı içermez.

import { Link } from 'react-router-dom'
import { gorunumUrl } from '../common/yonetimMenusu.js'
import '../styles/kirinti-yolu.css'

// KirintiYolu: verilen segment nesnelerini ayırıcılarla ayrılmış tek satır olarak
// çizer. props: ogeler ({ baslik, gorunum } dizisi, kökten mevcut sayfaya).
// gorunum dolu VE son segment değilse Link ile ilgili sayfaya (gorunumUrl) gidilir;
// aksi halde düz span kalır. Dizi boşsa gösterilecek konum yoktur, hiçbir şey
// render edilmez. Ayırıcı yalnızca görsel olduğundan ekran okuyuculardan gizlenir.
function KirintiYolu({ ogeler = [] }) {
  if (ogeler.length === 0) return null

  const sonIndeks = ogeler.length - 1

  return (
    <nav className="kirinti-yolu" aria-label="Sayfa yolu">
      {ogeler.map((oge, indeks) => {
        const sonMu = indeks === sonIndeks
        const tiklanabilir = Boolean(oge.gorunum) && !sonMu
        return (
          <span key={`${indeks}-${oge.baslik}`}>
            {indeks > 0 && (
              <span className="kirinti-yolu-ayirici" aria-hidden="true">
                ›
              </span>
            )}
            {tiklanabilir ? (
              <Link
                className="kirinti-yolu-oge kirinti-yolu-baglanti"
                to={gorunumUrl(oge.gorunum)}
              >
                {oge.baslik}
              </Link>
            ) : (
              <span
                className={`kirinti-yolu-oge${sonMu ? ' kirinti-yolu-son' : ''}`}
              >
                {oge.baslik}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default KirintiYolu
