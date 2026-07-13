// Anket soruları listesi bileşeni. Admin panelinden "Anket Soruları" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// veriyi soruApi üzerinden ister ve tabloda gösterir; iş kuralı, yetki kontrolü
// veya hesaplama İÇERMEZ (yetki sunucuda uygulanır). Yükleniyor ve hata durumları
// ayrı mesajla ele alınır; soru yoksa tablo başlıklarıyla boş gövde görünür (ayrı
// bir "bulunamadı" metni yazılmaz). Kullanıcıya yalnızca güvenli mesaj gösterilir.
// Başlık yanındaki arama kutusu, ekranda zaten çekili olan veriyi
// client-side süzer (soru metninin düz metni, soru tipi, hazırlayan adı) ve
// yalnızca bir gösterim kolaylığıdır (iş kuralı değil). "Güncelle" butonu, üst
// bileşene (onSoruDuzenle) haber vererek içerik alanında soru düzenleme görünümünü
// açar (satır özetini taşır; form mevcut alanları backend'den kendisi çeker).
// "Sil" ise önce bir onay kutusu açar, onaylanınca sunucuya silme isteği atar ve
// listeyi tazeler. Tablo/stil sınıfları kullanıcı listesiyle paylaşılır (DRY);
// yalnızca soruya özgü ekler soru- önekli sınıflarla gelir. Başlık satırının
// sağında "Yeni Soru Ekle" butonu bulunur; tıklanınca üst bileşene (onSoruEkle)
// haber vererek içerik alanında soru ekleme görünümünü açar (anket/kullanıcı
// ekle butonlarıyla aynı kalıp).

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sorulariGetir, soruSil } from '../api/soruApi.js'
import { soruTipiEtiketi } from '../common/soruTipleri.js'
import OnayKutusu from './OnayKutusu.jsx'
import '../styles/kullanici-listesi.css'
import '../styles/soru-listesi.css'

// Tablo kolon başlıkları (bu sırayla). "İşlem" sütunu Güncelle + Sil taşır.
const SORU_KOLON_BASLIKLARI = [
  'Soru Metni',
  'Seçenekler',
  'Diğer Bilgiler',
  'İşlem',
]

// ArtiIcon: artı (+) simgesini çizer. Başlık satırındaki "Yeni Soru Ekle"
// butonunda kullanılır (kullanıcı/anket listesindeki ekle butonuyla aynı görünüm).
function ArtiIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// BuyutecIcon: büyüteç (arama) simgesini çizer. Başlık yanındaki arama kutusunun
// içinde görsel ipucu olarak kullanılır (kullanıcı/anket listesiyle tasarım paritesi).
function BuyutecIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

// htmlDenDuzMetin: sanitize edilmiş HTML içeriğini yalnızca ARAMA amaçlı düz
// metne çevirir (etiketler ayıklanır). DOMParser script çalıştırmaz; içerik
// zaten sunucuda sanitize edilmiştir. Salt gösterim/süzme yardımcısıdır.
function htmlDenDuzMetin(html) {
  if (!html) {
    return ''
  }
  const belge = new DOMParser().parseFromString(html, 'text/html')
  return belge.body.textContent ?? ''
}

// hazirlayanAdiBicimlendir: hazırlayanın ad ve soyadını tek okunur metinde
// birleştirir. İkisi de yoksa tire ('—') döner. Saf gösterim formatlamasıdır.
function hazirlayanAdiBicimlendir(soru) {
  const tamAd = `${soru.hazirlayan_ad ?? ''} ${soru.hazirlayan_soyad ?? ''}`.trim()
  return tamAd === '' ? '—' : tamAd
}

// soruAramayaUyuyorMu: bir soru satırının, girilen arama metnine uyup uymadığını
// döner. Ekranda görünen/anlamlı alanlardan (soru metninin düz metni, soru tipinin
// TÜRKÇE ETİKETİ, hazırlayan adı) tek bir metin oluşturup Türkçe locale ile
// büyük/küçük harf duyarsız alt-dize kontrolü yapar. Kullanıcı ekranda gördüğü
// etiketle arayabilsin diye ham kimlik değil etiket üzerinden süzülür. Boş aramada
// tüm satırlar uyar. Saf sunum süzme mantığıdır; iş kuralı taşımaz.
function soruAramayaUyuyorMu(soru, aramaMetni) {
  const aranan = aramaMetni.trim().toLocaleLowerCase('tr')
  if (aranan === '') {
    return true
  }
  const aranabilirAlanlar = [
    htmlDenDuzMetin(soru.soru_metni),
    soruTipiEtiketi(soru.soru_tipi),
    hazirlayanAdiBicimlendir(soru),
  ]
  const aranabilirMetin = aranabilirAlanlar.join(' ').toLocaleLowerCase('tr')
  return aranabilirMetin.includes(aranan)
}

// SoruListesi: soruları React Query ile çeker ve durumuna göre yükleniyor / hata
// / boş / tablo gösterir. Veri kaynağı yalnızca soruApi'dir. Silme ve düzenleme
// tetikleme dışında yan etkisi yoktur.
// props: onSoruEkle() -> "Yeni Soru Ekle" tıklanınca çağrılır (üst bileşen soru
// ekleme görünümünü açar); onSoruDuzenle(soru) -> bir satırın "Güncelle" butonu
// tıklanınca çağrılır (üst bileşen o soru için düzenleme görünümünü açar).
function SoruListesi({ onSoruEkle, onSoruDuzenle }) {
  const [aramaMetni, setAramaMetni] = useState('')
  // Onay kutusunun hedefi olan soru (null iken onay kutusu kapalı).
  const [hedefSoru, setHedefSoru] = useState(null)
  // Silme isteği başarısız olursa gösterilecek güvenli, kısa mesaj.
  const [islemHatasi, setIslemHatasi] = useState('')

  const queryClient = useQueryClient()
  const {
    data: sorular,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['sorular'],
    queryFn: sorulariGetir,
  })

  // Silme isteği: başarıda listeyi tazeler ve onay kutusunu kapatır; hatada onay
  // kutusunu kapatır ve backend'in güvenli mesajını ekrana yansıtır (teknik detay
  // sızmaz). Yetki ve idempotentlik sunucuda ele alınır.
  const silmeMutation = useMutation({
    mutationFn: soruSil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorular'] })
      setHedefSoru(null)
    },
    onError: (hata) => {
      setHedefSoru(null)
      setIslemHatasi(hata.message)
    },
  })

  // silmeyeBasla: bir satırın "Sil" butonu tıklanınca varsa önceki hatayı temizler
  // ve seçilen soru için onay kutusunu açar.
  function silmeyeBasla(soru) {
    setIslemHatasi('')
    setHedefSoru(soru)
  }

  // silmeyiOnayla: onay kutusundaki onay butonuna basılınca hedef sorunun silme
  // isteğini tetikler.
  function silmeyiOnayla() {
    silmeMutation.mutate(hedefSoru.soru_id)
  }

  if (isPending) {
    return <p className="kullanici-liste-durum">Yükleniyor...</p>
  }

  if (isError) {
    // error.message backend'in güvenli mesajıdır; teknik detay sızmaz.
    return (
      <p className="kullanici-liste-durum kullanici-liste-hata">
        {error.message}
      </p>
    )
  }

  // Ekranda çekili veri, arama metnine göre süzülür; boş aramada tümü gelir.
  // sorular normalde dizidir; yine de null-güvenli süzülür.
  const filtreliSorular = (sorular ?? []).filter((soru) =>
    soruAramayaUyuyorMu(soru, aramaMetni),
  )

  return (
    <section className="kullanici-liste">
      <div className="kullanici-liste-baslik-satiri">
        <div className="kullanici-liste-baslik-grup">
          <h2 className="kullanici-liste-baslik">Anket Soruları</h2>
          <div className="kullanici-arama-sarmalayici">
            <span className="kullanici-arama-ikon">
              <BuyutecIcon />
            </span>
            <input
              type="search"
              className="kullanici-arama-kutusu"
              value={aramaMetni}
              onChange={(olay) => setAramaMetni(olay.target.value)}
              placeholder="Ara: soru metni, tip, hazırlayan"
              aria-label="Anket sorularında ara"
            />
          </div>
        </div>
        {/* "Yeni Soru Ekle": kullanıcı/anket listesindeki ekle kalıbıyla üst
            bileşene haber verir ve içerik alanında soru ekleme görünümünü açar. */}
        <button
          type="button"
          className="kullanici-ekle-buton"
          onClick={onSoruEkle}
        >
          <ArtiIcon />
          <span>Yeni Soru Ekle</span>
        </button>
      </div>
      {islemHatasi && (
        <p className="kullanici-liste-durum kullanici-liste-hata" role="alert">
          {islemHatasi}
        </p>
      )}
      <div className="kullanici-tablo-sarmalayici">
        <table className="kullanici-tablo">
          <thead>
            <tr>
              {SORU_KOLON_BASLIKLARI.map((baslik) => (
                <th key={baslik}>{baslik}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtreliSorular.map((soru) => (
              <tr key={soru.soru_id}>
                <td>
                  {/* soru_metni SUNUCUDA (nh3, migration 007) sanitize edilmiş
                      HTML'dir; UI yeniden sanitize etmez/işlemez. Bu yüzden
                      dangerouslySetInnerHTML güvenlidir. Uzun içerik CSS ile
                      (soru-metni-icerik) sarılır, hücre taşmaz. */}
                  <div
                    className="soru-metni-icerik"
                    dangerouslySetInnerHTML={{ __html: soru.soru_metni }}
                  />
                </td>
                <td>
                  {soru.secenekler && soru.secenekler.length > 0 ? (
                    <ul className="soru-secenek-listesi">
                      {soru.secenekler.map((secenek, sira) => (
                        // secenek_metni SUNUCUDA sanitize edilmiş HTML'dir (soru_metni
                        // ile aynı kalıp); UI yeniden sanitize etmez. Bu yüzden
                        // dangerouslySetInnerHTML güvenlidir.
                        <li
                          key={`${soru.soru_id}-${sira}`}
                          className="soru-secenek-rozet"
                          dangerouslySetInnerHTML={{ __html: secenek.secenek_metni }}
                        />
                      ))}
                    </ul>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <div className="soru-diger-bilgiler">
                    <span className="soru-diger-satir">
                      Soru Tipi: {soruTipiEtiketi(soru.soru_tipi)}
                    </span>
                    <span className="soru-diger-satir">
                      Hazırlayan: {hazirlayanAdiBicimlendir(soru)}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="soru-islem-hucre">
                    {/* Güncelle: üst bileşene haber vererek bu soru için düzenleme
                        görünümünü açar (form alanları backend'den çekilir). */}
                    <button
                      type="button"
                      className="soru-islem-buton soru-guncelle-buton"
                      onClick={() => onSoruDuzenle(soru)}
                    >
                      Güncelle
                    </button>
                    <button
                      type="button"
                      className="soru-islem-buton soru-sil-buton"
                      onClick={() => silmeyeBasla(soru)}
                    >
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hedefSoru && (
        <OnayKutusu
          baslik="Soruyu sil"
          mesaj="Bu soruyu silmek istediğinize emin misiniz?"
          onaylaMetni="Sil"
          onOnayla={silmeyiOnayla}
          onVazgec={() => setHedefSoru(null)}
          islemAktif={silmeMutation.isPending}
        />
      )}
    </section>
  )
}

export default SoruListesi
