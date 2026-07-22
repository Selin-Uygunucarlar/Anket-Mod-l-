// Ankete atanmış kullanıcının bir anketi açtığında geldiği doldurma (cevaplama)
// sayfası. Yalnızca sunum sorumluluğundadır: rota parametresinden anket kimliğini
// okur, anketi backend'den çeker (React Query) ve durumuna göre yükleniyor / hata /
// tamamlanmış / doldurulabilir görünümünü gösterir. Cevap toplama ve gönderme işi
// alt bileşen AnketDoldurForm'a devredilir. İş kuralı, hesaplama veya doğrulama
// İÇERMEZ (otorite sunucudur); yalnızca gösterim ve alt bileşene veri/callback aktarır.

import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { anketDoldurGetir } from '../api/anketApi.js'
import AnketDoldurForm from '../components/AnketDoldurForm'
import '../styles/anket-doldur.css'

// AnketDoldurPage: anketId'yi rota parametresinden okuyup anketi çeker ve uygun
// görünümü çizer. Başarılı gönderimde ana ekrana döner (kart panelden düşer).
function AnketDoldurPage() {
  const { anketId } = useParams()
  const navigate = useNavigate()

  const {
    data: anket,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anketDoldur', anketId],
    queryFn: () => anketDoldurGetir(anketId),
  })

  // onGonderimBasarili: cevaplar kaydedilince ana ekrana yönlendirir; kullanıcı
  // orada güncel (tamamlanan anketin düştüğü) paneli görür.
  function onGonderimBasarili() {
    navigate('/')
  }

  if (isPending) {
    return (
      <div className="anket-doldur-sayfa">
        <p className="anket-doldur-durum">Anket yükleniyor...</p>
      </div>
    )
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır (404 -> "Anket bulunamadı."
    // gibi); teknik detay/stack sızmaz.
    return (
      <div className="anket-doldur-sayfa">
        <div className="anket-doldur-kart">
          <p className="anket-doldur-durum anket-doldur-hata">{error.message}</p>
          <Link className="anket-doldur-geri" to="/">
            Ana ekrana dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="anket-doldur-sayfa">
      <div className="anket-doldur-kart">
        <div className="anket-doldur-ust">
          <Link className="anket-doldur-geri" to="/">
            ← Ana ekrana dön
          </Link>
        </div>

        <h1 className="anket-doldur-baslik">{anket.ad}</h1>

        {/* Anket açılış metni (varsa) sunucuda sanitize edilmiş HTML olabilir. */}
        {anket.on_yazi ? (
          <div
            className="anket-doldur-on-yazi"
            dangerouslySetInnerHTML={{ __html: anket.on_yazi }}
          />
        ) : null}

        {anket.tamamlandi_mi ? (
          <p className="anket-doldur-bilgi" role="status">
            Bu anketi zaten tamamladınız. Cevaplarınız kaydedildi.
          </p>
        ) : null}

        <AnketDoldurForm
          anket={anket}
          onBasarili={onGonderimBasarili}
          saltOkunur={anket.tamamlandi_mi}
        />

        {/* Kapanış metni (varsa) sunucuda sanitize edilmiş HTML olabilir. */}
        {anket.son_yazi ? (
          <div
            className="anket-doldur-son-yazi"
            dangerouslySetInnerHTML={{ __html: anket.son_yazi }}
          />
        ) : null}
      </div>
    </div>
  )
}

export default AnketDoldurPage
