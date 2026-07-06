// Kullanıcı listesi bileşeni. Admin panelinden "Kullanıcı Listesi" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// veriyi kullaniciApi üzerinden ister ve tabloda gösterir; iş kuralı, yetki
// kontrolü veya hesaplama İÇERMEZ (yetki sunucuda uygulanır). Yükleniyor, hata,
// boş ve dolu durumları ayrı ayrı ele alınır; kullanıcıya yalnızca güvenli
// mesaj gösterilir.

import { useQuery } from '@tanstack/react-query'
import { listKullanicilar } from '../api/kullaniciApi.js'

// tarihiBicimlendir: ISO 8601 tarih metnini Türkçe okunur biçime çevirir.
// null/boş/geçersiz değerde tire ('-') döner. Saf sunum biçimlendirmesidir;
// iş kuralı taşımaz.
function tarihiBicimlendir(isoMetin) {
  if (!isoMetin) {
    return '-'
  }
  const tarih = new Date(isoMetin)
  if (Number.isNaN(tarih.getTime())) {
    return '-'
  }
  return tarih.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// yoneticiAdiGoster: yönetici ad/soyadını birleştirir; ikisi de yoksa tire döner.
function yoneticiAdiGoster(yoneticiAd, yoneticiSoyad) {
  if (!yoneticiAd && !yoneticiSoyad) {
    return '-'
  }
  return `${yoneticiAd ?? ''} ${yoneticiSoyad ?? ''}`.trim()
}

// KullaniciListesi: kullanıcıları React Query ile çeker ve durumuna göre
// yükleniyor / hata / boş / tablo gösterir.
function KullaniciListesi() {
  const {
    data: kullanicilar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['kullanicilar'],
    queryFn: listKullanicilar,
  })

  if (isPending) {
    return <p className="kullanici-liste-durum">Yükleniyor...</p>
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır (ör. 403 yetki mesajı);
    // teknik detay sızmaz.
    return (
      <p className="kullanici-liste-durum kullanici-liste-hata">
        {error.message}
      </p>
    )
  }

  if (!kullanicilar || kullanicilar.length === 0) {
    return (
      <p className="kullanici-liste-durum">Kayıtlı kullanıcı bulunamadı.</p>
    )
  }

  return (
    <section className="kullanici-liste">
      <h2 className="kullanici-liste-baslik">Kullanıcı Listesi</h2>
      <div className="kullanici-tablo-sarmalayici">
        <table className="kullanici-tablo">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Sicil No</th>
              <th>Durum</th>
              <th>E-posta</th>
              <th>Yönetici</th>
              <th>Sisteme Eklenme</th>
              <th>Son Giriş</th>
            </tr>
          </thead>
          <tbody>
            {kullanicilar.map((kullanici) => (
              <tr key={kullanici.kullanici_kodu}>
                <td>{`${kullanici.ad} ${kullanici.soyad}`}</td>
                <td>{kullanici.kullanici_kodu}</td>
                <td>{kullanici.aktif ? 'Aktif' : 'Pasif'}</td>
                <td>{kullanici.email}</td>
                <td>
                  {yoneticiAdiGoster(
                    kullanici.yonetici_ad,
                    kullanici.yonetici_soyad,
                  )}
                </td>
                <td>{tarihiBicimlendir(kullanici.olusturma_tarihi)}</td>
                <td>{tarihiBicimlendir(kullanici.son_giris_tarihi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default KullaniciListesi
