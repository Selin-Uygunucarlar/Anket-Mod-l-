// Kırıntı yolu (breadcrumb) bileşeni. İçerik alanının üstünde, kullanıcının
// menüde hangi dalın altında olduğunu "Kullanıcı Yönetimi › Kullanıcı Listeleri
// › Kullanıcı Listesi" biçiminde düz metin olarak gösterir. Tıklanabilir
// değildir; yalnızca konum bildirir. Salt gösterim sorumluluğundadır.

import '../styles/kirinti-yolu.css'

// KirintiYolu: verilen başlık dizisini ayırıcılarla ayrılmış tek satır olarak
// çizer. props: basliklar (string dizisi, kökten mevcut sayfaya). Dizi boşsa
// gösterilecek bir konum yoktur, hiçbir şey render edilmez. Ayırıcı yalnızca
// görsel olduğundan ekran okuyuculardan gizlenir.
function KirintiYolu({ basliklar = [] }) {
  if (basliklar.length === 0) return null

  const sonIndeks = basliklar.length - 1

  return (
    <nav className="kirinti-yolu" aria-label="Sayfa yolu">
      {basliklar.map((baslik, indeks) => (
        <span key={baslik}>
          {indeks > 0 && (
            <span className="kirinti-yolu-ayirici" aria-hidden="true">
              ›
            </span>
          )}
          <span
            className={`kirinti-yolu-oge${indeks === sonIndeks ? ' kirinti-yolu-son' : ''}`}
          >
            {baslik}
          </span>
        </span>
      ))}
    </nav>
  )
}

export default KirintiYolu
