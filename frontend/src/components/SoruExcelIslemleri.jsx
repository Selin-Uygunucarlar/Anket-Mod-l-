// Soru listesi başlığındaki Excel toplu işlem butonları: "Şablon İndir" ve
// "Excel ile Yükle". Soru listesinden AYRI dosyadır; liste zaten arama/silme/
// düzenleme sorumluluklarını taşır (SRP + dosya boyutu). Yalnızca sunum işidir:
// şablonu soruApi üzerinden ister ve tarayıcıya indirtir, yükleme kutusunu açar.
// Şablonun içeriğini ve tüm doğrulamayı sunucu üretir/yapar; burada hesaplama,
// dosya ayrıştırma veya iş kuralı YOKTUR. Hata durumunda yalnızca güvenli mesaj
// üst bileşene bildirilir (tek yerde gösterilsin diye).

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { soruSablonuIndir } from '../api/soruApi.js'
import SoruExcelYukleKutusu from './SoruExcelYukleKutusu.jsx'

// İndirilen şablonun kullanıcının diskinde göreceği sabit dosya adı. Sunucunun
// Content-Disposition başlığı okunmaz (CORS'ta erişilebilir olmayabilir).
const SABLON_DOSYA_ADI = 'anket_sorulari_sablonu.xlsx'

// IndirIcon: aşağı ok (indirme) simgesini çizer. "Şablon İndir" butonunda,
// listedeki ekle butonunun ikon+metin kalıbıyla aynı görünüm için kullanılır.
function IndirIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="4" x2="12" y2="15" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="5" y1="19" x2="19" y2="19" />
    </svg>
  )
}

// YukleIcon: yukarı ok (yükleme) simgesini çizer. "Excel ile Yükle" butonunda
// kullanılır; indirme ikonunun aynadaki karşılığıdır.
function YukleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="15" x2="12" y2="4" />
      <polyline points="7 9 12 4 17 9" />
      <line x1="5" y1="19" x2="19" y2="19" />
    </svg>
  )
}

// dosyayiIndir: sunucudan gelen dosya içeriğini (Blob) verilen sabit adla
// tarayıcıya indirtir. Geçici bir nesne URL'i üretip görünmez bir bağlantıyı
// tıklar ve URL'i serbest bırakır. Salt tarayıcı davranışıdır.
function dosyayiIndir(dosyaIcerigi, dosyaAdi) {
  const nesneUrl = URL.createObjectURL(dosyaIcerigi)
  const indirmeBaglantisi = document.createElement('a')
  indirmeBaglantisi.href = nesneUrl
  indirmeBaglantisi.download = dosyaAdi
  document.body.appendChild(indirmeBaglantisi)
  indirmeBaglantisi.click()
  indirmeBaglantisi.remove()
  URL.revokeObjectURL(nesneUrl)
}

// SoruExcelIslemleri: iki butonu ve (açıkken) toplu yükleme kutusunu render eder.
// props: onHata(mesaj) -> şablon indirme başarısız olunca güvenli mesajı üst
// bileşene bildirir; yeni denemede boş metinle çağrılarak önceki hata temizlenir.
function SoruExcelIslemleri({ onHata }) {
  // Toplu yükleme kutusu açık mı (salt UI durumu).
  const [yuklemeKutusuAcik, setYuklemeKutusuAcik] = useState(false)

  // Şablon indirme isteği: başarıda gelen dosya içeriğini sabit adla tarayıcıya
  // indirtir; hatada backend'in güvenli mesajını üst bileşene bildirir (teknik
  // detay sızmaz).
  const sablonMutation = useMutation({
    mutationFn: soruSablonuIndir,
    onSuccess: (dosyaIcerigi) => {
      dosyayiIndir(dosyaIcerigi, SABLON_DOSYA_ADI)
    },
    onError: (hata) => {
      onHata(hata.message)
    },
  })

  // sablonuIndir: "Şablon İndir" tıklanınca varsa önceki hatayı temizler ve
  // indirme isteğini tetikler.
  function sablonuIndir() {
    onHata('')
    sablonMutation.mutate()
  }

  // yuklemeKutusunuAc: "Excel ile Yükle" tıklanınca varsa önceki hatayı temizler
  // ve toplu yükleme kutusunu açar.
  function yuklemeKutusunuAc() {
    onHata('')
    setYuklemeKutusuAcik(true)
  }

  return (
    <>
      <button
        type="button"
        className="kullanici-ekle-buton"
        onClick={sablonuIndir}
        disabled={sablonMutation.isPending}
      >
        <IndirIcon />
        <span>{sablonMutation.isPending ? 'İndiriliyor...' : 'Şablon İndir'}</span>
      </button>
      <button
        type="button"
        className="kullanici-ekle-buton"
        onClick={yuklemeKutusunuAc}
      >
        <YukleIcon />
        <span>Excel ile Yükle</span>
      </button>
      {yuklemeKutusuAcik && (
        <SoruExcelYukleKutusu onKapat={() => setYuklemeKutusuAcik(false)} />
      )}
    </>
  )
}

export default SoruExcelIslemleri
