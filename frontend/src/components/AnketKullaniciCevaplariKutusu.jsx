// Bir kullanıcının BİR anketteki cevaplarını gösteren kutu (modal). Atama
// kutusundaki "Cevapları Gör" butonuyla, o kutunun üstünde açılır. Yalnızca sunum
// sorumluluğundadır: anketApi üzerinden cevapları ister ve soru sırasıyla gösterir;
// iş kuralı, yetki kararı veya hesaplama İÇERMEZ (yetki sunucuda uygulanır).
// soru_metni / verilen_secenekler / cevap_metni SUNUCUDA SANITIZE EDİLMİŞ HTML'dir;
// AnketDoldurSoruKarti'ndaki kalıpla dangerouslySetInnerHTML ile gösterilir.
// Cevapsız sorular listede kalır ve "Cevaplanmamış" olarak işaretlenir; kişi anketi
// tamamlamamışsa (tamamlandi_mi=false) cevapların eksik olabileceği not edilir.
// Perde, kart ve butonlar onay-kutusu.css'ten PAYLAŞILIR (DRY); yalnızca bu kutuya
// özgü ekler anket-sonuc-kutusu.css'tedir. Escape / perde / "Kapat" ile kapanır.

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { kullaniciCevaplariniGetir } from '../api/anketApi.js'
import { adSoyadBirlestir } from '../common/metinBicimlendir.js'
import '../styles/kullanici-listesi.css'
import '../styles/onay-kutusu.css'
import '../styles/anket-sonuc-kutusu.css'

// VerilenCevap: tek bir sorunun cevap gövdesini çizer. Şık(lar) ve serbest metin
// birlikte gelebilir; ikisi de yoksa görünür bir "Cevaplanmamış" ibaresi konur.
function VerilenCevap({ soru }) {
  const secenekler = soru.verilen_secenekler ?? []
  const metin = soru.cevap_metni

  if (secenekler.length === 0 && !metin) {
    return <p className="anket-sonuc-cevapsiz">Cevaplanmamış</p>
  }

  return (
    <>
      {secenekler.length > 0 && (
        <ul className="anket-sonuc-secenek-liste">
          {secenekler.map((secenekMetni, sira) => (
            // Şık metni sunucuda sanitize edilmiş HTML'dir; UI yeniden işlemez.
            // Aynı metin tekrar edebileceğinden anahtar sıra ile birleştirilir.
            <li
              key={`${sira}-${secenekMetni}`}
              dangerouslySetInnerHTML={{ __html: secenekMetni }}
            />
          ))}
        </ul>
      )}
      {metin && (
        <div
          className="anket-sonuc-metin-cevap"
          dangerouslySetInnerHTML={{ __html: metin }}
        />
      )}
    </>
  )
}

// AnketKullaniciCevaplariKutusu: seçilen kişinin anket cevaplarını modal içinde
// listeler.
// props: anket -> liste satırı ({ anket_id, ad }); kullanici -> { kullanici_kodu,
// ad, soyad }; onKapat() -> perde/Kapat/Escape ile kapanınca çağrılır (üst bileşen
// kutuyu kaldırır ve atama kutusuna geri döner).
function AnketKullaniciCevaplariKutusu({ anket, kullanici, onKapat }) {
  const kapatButonRef = useRef(null)
  const kisiAdi = adSoyadBirlestir(kullanici.ad, kullanici.soyad)
  const kutuBasligi = `${kisiAdi} — ${anket.ad}`

  const {
    data: cevaplar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anket-kullanici-cevaplari', anket.anket_id, kullanici.kullanici_kodu],
    queryFn: () =>
      kullaniciCevaplariniGetir(anket.anket_id, kullanici.kullanici_kodu),
  })

  // Açılınca "Kapat" butonuna odaklan ve Escape ile kapanmayı dinle (klavye
  // erişilebilirliği). Bu kutu en üstte olduğundan Escape'i o karşılar.
  useEffect(() => {
    kapatButonRef.current?.focus()

    // kapatEscape: Escape tuşuna basılınca kapatma akışını tetikler.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        onKapat()
      }
    }

    document.addEventListener('keydown', kapatEscape)
    return () => document.removeEventListener('keydown', kapatEscape)
  }, [onKapat])

  // perdeyeTiklandi: yalnızca perdenin kendisine (kutunun dışına) tıklanınca
  // kapatır; kutu içine yapılan tıklamalar yayılmaz.
  function perdeyeTiklandi(olay) {
    if (olay.target === olay.currentTarget) {
      onKapat()
    }
  }

  const sorular = cevaplar?.sorular ?? []

  return (
    <div className="onay-perde" onClick={perdeyeTiklandi}>
      <div
        className="onay-kutu anket-sonuc-kutu"
        role="dialog"
        aria-modal="true"
        aria-label={`Cevaplar: ${kutuBasligi}`}
      >
        <h3 className="onay-kutu-baslik">Cevaplar</h3>
        <p className="onay-kutu-mesaj">{kutuBasligi}</p>

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
          <>
            {/* Kişi anketi tamamlamamışsa cevaplar eksik olabilir; bu bilgi
                sunucudan gelir (tamamlandi_mi), UI yorum üretmez. */}
            {cevaplar.tamamlandi_mi === false && (
              <p className="anket-sonuc-bilgi" role="status">
                Bu kişi anketi tamamlamamış; cevaplar eksik olabilir.
              </p>
            )}

            {sorular.length === 0 ? (
              <p className="kullanici-liste-durum">
                Bu ankette gösterilecek soru bulunamadı.
              </p>
            ) : (
              <ol className="anket-sonuc-cevap-liste">
                {sorular.map((soru, sira) => (
                  <li key={soru.soru_id} className="anket-sonuc-cevap-oge">
                    <div className="anket-sonuc-soru-metin">
                      <span className="anket-sonuc-soru-no">{`${sira + 1}.`}</span>
                      {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir. */}
                      <span dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
                    </div>
                    <VerilenCevap soru={soru} />
                  </li>
                ))}
              </ol>
            )}
          </>
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

export default AnketKullaniciCevaplariKutusu
