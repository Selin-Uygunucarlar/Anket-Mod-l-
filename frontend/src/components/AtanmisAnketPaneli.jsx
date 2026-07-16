// Ana ekran "Anketler" paneli. Giriş yapan kullanıcıya atanmış, aktif ve henüz
// tamamlanmamış anketleri yatay kutular halinde salt gösterim olarak sunar.
// Yalnızca sunum sorumluluğundadır: veriyi anketApi üzerinden ister ve gösterir;
// iş kuralı, yetki kontrolü veya hesaplama İÇERMEZ (kime hangi anketin atandığı
// sunucuda çözülür). Yükleniyor / hata / boş / dolu durumları sade biçimde ele
// alınır; kullanıcıya yalnızca güvenli mesaj gösterilir. Kutular tıklanabilir
// değildir (aksiyon yoktur).

import { useEffect, useState } from 'react'
import { atanmisAnketleriGetir } from '../api/anketApi.js'
import anketGorseli from '../assets/anket.png'
import '../styles/atanmis-anket-paneli.css'

// KUTU_GORSELI: her anket kutusunun üstünde gösterilen görsel; tüm kutular ortak
// anket görselini (anket.png) gösterir. Görseli değiştirmek için yalnızca burası
// güncellenir.
const KUTU_GORSELI = anketGorseli

// AtanmisAnketPaneli: mount olunca atanmış anketleri çeker ve durumuna göre
// yükleniyor / hata / boş / kutu ızgarası gösterir. Veri kaynağı yalnızca
// anketApi'dir; props almaz.
function AtanmisAnketPaneli() {
  const [anketler, setAnketler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hataMesaji, setHataMesaji] = useState('')

  useEffect(() => {
    // Bileşen kaldırıldıysa state güncellemesini atlamak için iptal bayrağı.
    let iptalEdildi = false

    async function anketleriYukle() {
      setYukleniyor(true)
      setHataMesaji('')
      try {
        const gelenAnketler = await atanmisAnketleriGetir()
        if (!iptalEdildi) setAnketler(gelenAnketler ?? [])
      } catch (hata) {
        // hata.message backend'in / anketApi'nin güvenli mesajıdır; teknik detay yok.
        if (!iptalEdildi) setHataMesaji(hata.message)
      } finally {
        if (!iptalEdildi) setYukleniyor(false)
      }
    }

    anketleriYukle()
    return () => {
      iptalEdildi = true
    }
  }, [])

  return (
    <section className="atanmis-anket-paneli">
      <h2 className="atanmis-anket-baslik">Anketler</h2>

      {yukleniyor && (
        <p className="atanmis-anket-durum">Yükleniyor...</p>
      )}

      {!yukleniyor && hataMesaji && (
        <p className="atanmis-anket-durum atanmis-anket-hata">{hataMesaji}</p>
      )}

      {!yukleniyor && !hataMesaji && anketler.length === 0 && (
        <p className="atanmis-anket-durum">Size atanmış bekleyen anket yok.</p>
      )}

      {!yukleniyor && !hataMesaji && anketler.length > 0 && (
        <div className="atanmis-anket-izgara">
          {anketler.map((anket) => (
            <article className="atanmis-anket-kutu" key={anket.anket_id}>
              <img
                className="atanmis-anket-gorsel"
                src={KUTU_GORSELI}
                alt=""
                aria-hidden="true"
              />
              <span className="atanmis-anket-ad">{anket.ad}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AtanmisAnketPaneli
