// Anket formunda bir bölümü çerçeveleyen basit sunum kartı: en üstte bir başlık,
// altında ise içine verilen alanları (children) gösterir. Amaç, anketle ilgili
// FARKLI BAŞLIKLI bölümlerin tek satırla eklenebilmesidir. Genel/soyut bir yapı
// değildir; yalnızca baslik + children alır. İş kuralı, hesaplama veya girdi
// mantığı İÇERMEZ; salt gösterim sorumluluğundadır. Görünümü anket-ekle.css'ten
// gelir (.anket-kart, .anket-alt-baslik).

import '../styles/anket-ekle.css'

// AnketKart: başlıklı bir kart çerçevesi render eder.
// props: baslik -> kartın üst başlığı (düz metin ya da JSX/ReactNode; örn. kırmızı
//   zorunlu yıldızı içeren başlık), children -> kartın içeriği (form alanları).
function AnketKart({ baslik, children }) {
  return (
    <section className="anket-kart">
      <h3 className="anket-alt-baslik">{baslik}</h3>
      {children}
    </section>
  )
}

export default AnketKart
