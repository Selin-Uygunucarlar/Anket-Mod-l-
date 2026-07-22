// Excel ile TOPLU anket sorusu yükleme kutusu (modal). Soru listesindeki "Excel
// ile Yükle" butonuyla açılır. Yalnızca sunum sorumluluğundadır: kullanıcıdan bir
// .xlsx dosyası toplar, soruApi üzerinden sunucuya gönderir ve sonucu gösterir.
// Dosyayı istemcide AÇMAZ/ayrıştırmaz, satır saymaz, tip doğrulaması yapmaz —
// tüm doğrulama ve iş kuralları sunucudadır. Dosya seçilmeden "Yükle" butonunun
// pasif kalması yalnızca UX kolaylığıdır, güvenlik sınırı değildir.
// Sunucudan satır bazlı doğrulama hataları dönerse (kullanıcının KENDİ verisine
// ait: satır no / alan / mesaj) düzeltebilmesi için tabloda listelenir; teknik
// detay (stack trace vb.) hiçbir durumda ekrana yansımaz.
// Perde, kutu ve buton görünümü onay kutusu kalıbından paylaşılır (DRY);
// Escape / perdeye tıklama / "Kapat" ile kapanır (yükleme sürerken kapatılmaz).

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sorulariExcelIleYukle } from '../api/soruApi.js'
import '../styles/kullanici-listesi.css'
import '../styles/onay-kutusu.css'
import '../styles/soru-excel-yukle.css'

// Satır hatası tablosunun kolon başlıkları (bu sırayla).
const HATA_KOLON_BASLIKLARI = ['Satır no', 'Alan', 'Mesaj']

// SoruExcelYukleKutusu: dosya seçme + yükleme modalını render eder.
// props: onKapat() -> perde/Kapat/Escape ile kapanınca çağrılır (üst bileşen
// kutuyu kaldırır).
function SoruExcelYukleKutusu({ onKapat }) {
  // Kullanıcının seçtiği dosya (null iken henüz seçim yapılmamıştır).
  const [secilenDosya, setSecilenDosya] = useState(null)
  // Başarılı yüklemede sunucunun bildirdiği eklenen soru sayısı.
  const [eklenenSayisi, setEklenenSayisi] = useState(null)
  // Sunucudan gelen güvenli hata mesajı ve (varsa) satır bazlı hatalar.
  const [hataMesaji, setHataMesaji] = useState('')
  const [satirHatalari, setSatirHatalari] = useState([])

  const dosyaGirdiRef = useRef(null)
  const queryClient = useQueryClient()

  // Escape ile kapanmayı dinler (klavye erişilebilirliği). Perdeye tıklama ayrı
  // olarak overlay onClick'te ele alınır. Yalnızca UX'tir.
  useEffect(() => {
    // kapatEscape: Escape tuşuna basılınca kapatma akışını tetikler.
    function kapatEscape(olay) {
      if (olay.key === 'Escape') {
        onKapat()
      }
    }

    document.addEventListener('keydown', kapatEscape)
    return () => document.removeEventListener('keydown', kapatEscape)
  }, [onKapat])

  // Yükleme isteği: başarıda eklenen sayıyı gösterir ve soru listesini tazeler;
  // hatada sunucunun güvenli mesajını (varsa satır hatalarıyla birlikte) ekrana
  // yansıtır. Karar/doğrulama sunucuya aittir.
  const yuklemeMutation = useMutation({
    mutationFn: sorulariExcelIleYukle,
    onSuccess: (sonuc) => {
      setEklenenSayisi(sonuc)
      setHataMesaji('')
      setSatirHatalari([])
      queryClient.invalidateQueries({ queryKey: ['sorular'] })
    },
    onError: (hata) => {
      setEklenenSayisi(null)
      setHataMesaji(hata.message)
      setSatirHatalari(hata.satirHatalari ?? [])
    },
  })

  // dosyaSecildi: dosya girdisindeki seçim değişince seçili dosyayı saklar ve
  // önceki sonuç/hata gösterimini temizler (yeni deneme temiz başlasın).
  function dosyaSecildi(olay) {
    setSecilenDosya(olay.target.files?.[0] ?? null)
    setEklenenSayisi(null)
    setHataMesaji('')
    setSatirHatalari([])
  }

  // yuklemeyiBaslat: seçilen dosyayı sunucuya gönderir. Dosya seçilmemişse hiçbir
  // şey yapmaz (buton zaten pasiftir); bu salt UX guard'ıdır.
  function yuklemeyiBaslat() {
    if (!secilenDosya) {
      return
    }
    yuklemeMutation.mutate(secilenDosya)
  }

  const yuklemeSuruyor = yuklemeMutation.isPending

  return (
    <div
      className="onay-perde"
      onClick={(olay) => {
        // Yalnızca perdenin kendisine tıklanınca kapat; yükleme sürerken kapatma.
        if (olay.target === olay.currentTarget && !yuklemeSuruyor) {
          onKapat()
        }
      }}
    >
      <div
        className="onay-kutu soru-excel-kutu"
        role="dialog"
        aria-modal="true"
        aria-label="Excel ile soru yükle"
      >
        <h3 className="onay-kutu-baslik">Excel ile Soru Yükle</h3>
        <p className="onay-kutu-mesaj">
          Şablona göre doldurduğunuz .xlsx dosyasını seçip yükleyin.
        </p>

        <div className="soru-excel-dosya-satiri">
          <button
            type="button"
            className="onay-vazgec-buton"
            onClick={() => dosyaGirdiRef.current?.click()}
            disabled={yuklemeSuruyor}
          >
            Dosya Seç
          </button>
          <span className="soru-excel-dosya-adi">
            {secilenDosya ? secilenDosya.name : 'Dosya seçilmedi'}
          </span>
          <input
            ref={dosyaGirdiRef}
            type="file"
            accept=".xlsx"
            className="soru-excel-dosya-girdisi"
            onChange={dosyaSecildi}
            aria-label="Yüklenecek Excel dosyası"
          />
        </div>

        {eklenenSayisi !== null && (
          <p className="soru-excel-bilgi" role="status">
            {eklenenSayisi} soru yüklendi.
          </p>
        )}

        {/* Sunucunun güvenli mesajı olduğu gibi gösterilir (hiçbir soru
            yüklenmediği bilgisi de bu mesajda gelir); satır hatası varsa yalnızca
            ne yapılacağını söyleyen kısa bir yönerge eklenir. */}
        {hataMesaji && (
          <p
            className="kullanici-liste-durum kullanici-liste-hata"
            role="alert"
          >
            {hataMesaji}
            {satirHatalari.length > 0 &&
              ' Aşağıdaki satırları düzeltip tekrar deneyin.'}
          </p>
        )}

        {satirHatalari.length > 0 && (
          <div className="soru-excel-hata-liste kullanici-tablo-sarmalayici">
            <table className="kullanici-tablo">
              <thead>
                <tr>
                  {HATA_KOLON_BASLIKLARI.map((baslik) => (
                    <th key={baslik}>{baslik}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirHatalari.map((satirHatasi, sira) => (
                  <tr key={`${satirHatasi.satir_no}-${satirHatasi.alan}-${sira}`}>
                    <td>{satirHatasi.satir_no}</td>
                    <td>{satirHatasi.alan}</td>
                    <td>{satirHatasi.mesaj}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="onay-kutu-butonlar">
          <button
            type="button"
            className="onay-vazgec-buton"
            onClick={onKapat}
            disabled={yuklemeSuruyor}
          >
            Kapat
          </button>
          <button
            type="button"
            className="onay-onayla-buton"
            onClick={yuklemeyiBaslat}
            disabled={yuklemeSuruyor || !secilenDosya}
          >
            {yuklemeSuruyor ? 'Yükleniyor...' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SoruExcelYukleKutusu
