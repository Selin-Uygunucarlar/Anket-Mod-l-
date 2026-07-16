// Ankete atanmış kullanıcının bir anketi açtığında geldiği sayfa. ŞİMDİLİK bir
// iskelettir (placeholder): cevaplama/doldurma akışı sonraki adımda eklenecektir.
// Yalnızca sunum sorumluluğundadır: rota parametresinden anket kimliğini okur ve
// güvenli bir bilgi metni ile ana ekrana dönüş bağlantısı gösterir. İş kuralı,
// hesaplama veya veri çekme İÇERMEZ.
import { useParams, Link } from 'react-router-dom'

// AnketDoldurPage: rota parametresindeki anketId'yi okur ve yapım aşamasında
// olduğunu belirten placeholder içerik ile ana ekrana dönüş bağlantısı sunar.
function AnketDoldurPage() {
  const { anketId } = useParams()

  return (
    <div className="anket-doldur-page" data-anket-id={anketId}>
      <div className="anket-doldur-kart">
        <h1 className="anket-doldur-baslik">Anket</h1>
        <p className="anket-doldur-aciklama">
          Bu ekran yapım aşamasında. Anketi doldurma özelliği yakında
          eklenecektir.
        </p>
        <Link className="anket-doldur-geri" to="/">
          Ana ekrana dön
        </Link>
      </div>
    </div>
  )
}

export default AnketDoldurPage
