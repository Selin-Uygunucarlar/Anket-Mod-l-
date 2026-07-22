// Anket listesindeki "Atanan Kullanıcı Sayısı" / "Yanıtlayan Kullanıcı Sayısı"
// hücresine tıklanınca açılan kişi listesi kutusu (modal). Yalnızca sunum
// sorumluluğundadır: anketApi üzerinden atama listesini ister ve tabloda gösterir;
// iş kuralı, yetki kararı veya hesaplama İÇERMEZ (yetki sunucuda uygulanır).
// "Yanıtladı mı" bilgisi SUNUCUDA türetilir (yanitladi_mi); UI yalnızca bu bayrakla
// süzer, durum metnine bakıp kendi kararını VERMEZ.
// Aynı anket için iki mod (atanan / yanıtlayan) TEK React Query anahtarını
// paylaşır; hücreler arasında geçişte ikinci kez istek atılmaz.
// Perde, kart ve butonlar onay-kutusu.css'ten, tablo kullanici-listesi.css'ten,
// "Cevapları Gör" butonu soru-listesi.css'ten PAYLAŞILIR (DRY); yalnızca bu kutuya
// özgü ekler anket-sonuc-kutusu.css'tedir. Escape / perdeye tıklama / "Kapat" ile
// kapanır; üstünde cevap kutusu açıkken kapatma en üsttekine aittir.

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { anketAtamalariniGetir } from '../api/anketApi.js'
import { adSoyadBirlestir, tarihSaatBicimlendir } from '../common/metinBicimlendir.js'
import '../styles/kullanici-listesi.css'
import '../styles/soru-listesi.css'
import '../styles/onay-kutusu.css'
import '../styles/anket-sonuc-kutusu.css'

// Moda göre değişen sunum metinleri ve son bilgi kolonu. Kutunun iki kullanımı
// (tüm atananlar / yalnızca yanıtlayanlar) arasındaki tek fark budur.
const MOD_AYARLARI = {
  atanan: {
    baslik: 'Atanan Kullanıcılar',
    sonKolonBasligi: 'Durum',
    bosMesaj: 'Bu ankete kimse atanmamış.',
  },
  yanitlayan: {
    baslik: 'Yanıtlayan Kullanıcılar',
    sonKolonBasligi: 'Tamamlanma Tarihi',
    bosMesaj: 'Bu anketi henüz kimse yanıtlamamış.',
  },
}

// AtamaSatiri: tek bir kişinin satırını çizer. Yanıtlayan modunda tamamlanma
// tarihi ve "Cevapları Gör" butonu, atanan modunda ham atama durumu gösterilir.
function AtamaSatiri({ atama, yanitlayanModu, onCevaplariGor }) {
  const adSoyad = adSoyadBirlestir(atama.ad, atama.soyad)

  return (
    <tr>
      <td>{adSoyad}</td>
      <td>{atama.email || '-'}</td>
      <td>
        {yanitlayanModu
          ? tarihSaatBicimlendir(atama.tamamlanma_tarihi)
          : atama.durum}
      </td>
      {yanitlayanModu ? (
        <td>
          <div className="soru-islem-hucre">
            {/* Cevapları Gör: üst bileşene haber vererek bu kişinin cevap
                kutusunu açar. Stil soru listesi İşlem butonlarıyla paylaşılır. */}
            <button
              type="button"
              className="soru-islem-buton soru-guncelle-buton"
              onClick={() =>
                onCevaplariGor({
                  kullanici_kodu: atama.kullanici_kodu,
                  ad: atama.ad,
                  soyad: atama.soyad,
                })
              }
              aria-label={`${adSoyad} kişisinin cevaplarını gör`}
            >
              Cevapları Gör
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  )
}

// AnketAtamaKutusu: ankete atanmış kişileri (moda göre süzülmüş) modal içinde
// listeler.
// props: anket -> liste satırı ({ anket_id, ad }); mod -> 'atanan' | 'yanitlayan';
// ustKutuAcik -> üstünde cevap kutusu açık mı (açıkken Escape/perde bu kutuyu
// kapatmaz, kapatma en üsttekine aittir); onKapat() -> kutuyu kaldırır;
// onCevaplariGor(kullanici) -> yanıtlayan satırındaki butona basılınca çağrılır.
function AnketAtamaKutusu({
  anket,
  mod,
  ustKutuAcik = false,
  onKapat,
  onCevaplariGor,
}) {
  const kapatButonRef = useRef(null)
  const ayar = MOD_AYARLARI[mod]
  const yanitlayanModu = mod === 'yanitlayan'

  // İki mod AYNI anahtarı paylaşır: hücreler arasında geçişte veri cache'ten gelir.
  const {
    data: atamalar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anket-atamalari', anket.anket_id],
    queryFn: () => anketAtamalariniGetir(anket.anket_id),
  })

  // Kutu en üstteyken "Kapat" butonuna odaklan ve Escape'i dinle (klavye
  // erişilebilirliği). Üstte cevap kutusu varken dinlemez; böylece Escape iki
  // kutuyu birden kapatmaz. Yalnızca UX'tir, güvenlik sınırı değildir.
  useEffect(() => {
    if (ustKutuAcik) {
      return undefined
    }
    kapatButonRef.current?.focus()

    // kapatEscape: Escape tuşuna basılınca kapatma akışını tetikler.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        onKapat()
      }
    }

    document.addEventListener('keydown', kapatEscape)
    return () => document.removeEventListener('keydown', kapatEscape)
  }, [ustKutuAcik, onKapat])

  // perdeyeTiklandi: yalnızca perdenin kendisine (kutunun dışına) tıklanınca
  // kapatır; kutu içine yapılan tıklamalar yayılmaz.
  function perdeyeTiklandi(olay) {
    if (olay.target === olay.currentTarget && !ustKutuAcik) {
      onKapat()
    }
  }

  // Yanıtlayan modunda liste sunucudan gelen yanitladi_mi bayrağıyla süzülür;
  // "yanıtladı mı" kararı UI'da ÜRETİLMEZ.
  const tumAtamalar = atamalar ?? []
  const satirlar = yanitlayanModu
    ? tumAtamalar.filter((atama) => atama.yanitladi_mi === true)
    : tumAtamalar

  const kolonBasliklari = ['Ad Soyad', 'E-posta', ayar.sonKolonBasligi]
  if (yanitlayanModu) {
    kolonBasliklari.push('İşlem')
  }

  return (
    <div className="onay-perde" onClick={perdeyeTiklandi}>
      <div
        className="onay-kutu anket-sonuc-kutu"
        role="dialog"
        aria-modal="true"
        aria-label={`${ayar.baslik} — ${anket.ad}`}
      >
        <h3 className="onay-kutu-baslik">{ayar.baslik}</h3>
        <p className="onay-kutu-mesaj">{anket.ad}</p>

        {isPending && <p className="kullanici-liste-durum">Yükleniyor...</p>}

        {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
        {isError && (
          <p
            className="kullanici-liste-durum kullanici-liste-hata"
            role="alert"
          >
            {error.message}
          </p>
        )}

        {!isPending && !isError && (
          <div className="anket-sonuc-tablo-alan kullanici-tablo-sarmalayici">
            <table className="kullanici-tablo">
              <thead>
                <tr>
                  {kolonBasliklari.map((baslik) => (
                    <th key={baslik}>{baslik}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.length === 0 ? (
                  <tr>
                    <td
                      colSpan={kolonBasliklari.length}
                      className="kullanici-liste-durum liste-bos-hucre"
                    >
                      {ayar.bosMesaj}
                    </td>
                  </tr>
                ) : (
                  satirlar.map((atama) => (
                    <AtamaSatiri
                      key={atama.kullanici_kodu}
                      atama={atama}
                      yanitlayanModu={yanitlayanModu}
                      onCevaplariGor={onCevaplariGor}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="onay-kutu-butonlar">
          <button
            type="button"
            className="onay-vazgec-buton"
            onClick={onKapat}
            ref={kapatButonRef}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

export default AnketAtamaKutusu
