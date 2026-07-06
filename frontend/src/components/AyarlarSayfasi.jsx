// Ayarlar (seçenek tanımları) sayfası bileşeni. Admin panelinden "Ayarlar >
// Seçenek Tanımları" seçilince anasayfa içerik alanında render edilir. Amaç:
// admin'in 10 yönetilen dropdown kategorisine yeni değerler eklemesi, mevcut
// değerleri görmesi ve silmesi (onay sonrası). Yalnızca sunum sorumluluğundadır:
// girdi toplar, seçenekleri secenekApi üzerinden ister/ekler/siler; iş kuralı,
// yetki veya hesaplama İÇERMEZ
// (yetki ve asıl doğrulama sunucuda). Boş değerde Ekle pasiftir (yalnızca UX).
// Sayfa açıklaması, başlık yanındaki bilgi (ⓘ) düğmesine tıklanınca açılan bir
// baloncukta gösterilir. Hata durumunda (zaten tanımlı seçenek dahil) yalnızca
// backend'in güvenli mesajı gösterilir; teknik detay sızmaz.

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler, ekleSecenek, silSecenek } from '../api/secenekApi.js'
import {
  SECENEK_KATEGORILERI,
  gruplaSeceneklerKategoriyeGore,
} from '../common/secenekKategorileri.js'
import '../styles/ayarlar.css'

// AyarlarSayfasi: seçenek ekleme formu + mevcut seçeneklerin gruplu listesi.
function AyarlarSayfasi() {
  // İlk kategori varsayılan seçili gelir; kullanıcı değiştirebilir.
  const [kategori, setKategori] = useState(SECENEK_KATEGORILERI[0].kimlik)
  const [deger, setDeger] = useState('')
  // Başlık yanındaki bilgi düğmesiyle açılan açıklama baloncuğunun durumu.
  const [aciklamaAcik, setAciklamaAcik] = useState(false)
  const bilgiSarmalayiciRef = useRef(null)
  const queryClient = useQueryClient()

  // Baloncuk açıkken dışarı tıklama veya Esc ile kapanmasını sağlar; kapalıyken
  // dinleyici eklemez. Cleanup ile dinleyiciler her zaman temizlenir.
  useEffect(() => {
    if (!aciklamaAcik) {
      return
    }
    function kapatDisTiklamada(olay) {
      if (
        bilgiSarmalayiciRef.current &&
        !bilgiSarmalayiciRef.current.contains(olay.target)
      ) {
        setAciklamaAcik(false)
      }
    }
    function kapatEscBasinca(olay) {
      if (olay.key === 'Escape') {
        setAciklamaAcik(false)
      }
    }
    document.addEventListener('mousedown', kapatDisTiklamada)
    document.addEventListener('keydown', kapatEscBasinca)
    return () => {
      document.removeEventListener('mousedown', kapatDisTiklamada)
      document.removeEventListener('keydown', kapatEscBasinca)
    }
  }, [aciklamaAcik])

  const {
    data: secenekler,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['secenekler'],
    queryFn: listSecenekler,
  })

  const ekleMutation = useMutation({
    mutationFn: ({ kategori: kat, deger: deg }) => ekleSecenek(kat, deg),
    onSuccess: () => {
      // Liste tazelensin ve eklenen değer görünsün.
      queryClient.invalidateQueries({ queryKey: ['secenekler'] })
      setDeger('')
    },
  })

  // handleSubmit: seçenek ekleme isteğini gönderir. Boş değerde buton pasif
  // olduğundan burada ek doğrulama yapılmaz; istek API stub'ına iletilir.
  function handleSubmit(olay) {
    olay.preventDefault()
    if (deger.trim() === '') {
      return
    }
    ekleMutation.mutate({ kategori, deger: deger.trim() })
  }

  const silMutation = useMutation({
    mutationFn: ({ kategori: kat, deger: deg }) => silSecenek(kat, deg),
    onSuccess: () => {
      // Silinen değer listeden kalksın.
      queryClient.invalidateQueries({ queryKey: ['secenekler'] })
    },
  })

  // handleSil: kullanıcıdan onay alıp bir seçenek değerinin silinmesini ister.
  // Onay yalnızca UX içindir; asıl yetki/doğrulama sunucuda yapılır.
  function handleSil(secenekKimligi, tekDeger) {
    const onaylandi = window.confirm(
      `"${tekDeger}" seçeneğini silmek istiyor musunuz?`,
    )
    if (!onaylandi) {
      return
    }
    silMutation.mutate({ kategori: secenekKimligi, deger: tekDeger })
  }

  const eklePasif = deger.trim() === '' || ekleMutation.isPending
  const gruplandirilmis = gruplaSeceneklerKategoriyeGore(secenekler)

  return (
    <section className="ayarlar">
      <div className="ayarlar-baslik-satiri">
        <h2 className="ayarlar-baslik">Seçenek Tanımları</h2>
        <div className="ayarlar-bilgi-sarmalayici" ref={bilgiSarmalayiciRef}>
          <button
            type="button"
            className="ayarlar-bilgi-dugmesi"
            aria-label="Seçenek Tanımları hakkında bilgi"
            aria-expanded={aciklamaAcik}
            onClick={() => setAciklamaAcik((acik) => !acik)}
          >
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="11" x2="12" y2="16" />
              <line x1="12" y1="8" x2="12" y2="8" />
            </svg>
          </button>
          {aciklamaAcik && (
            <div className="ayarlar-bilgi-baloncuk" role="tooltip">
              Kullanıcı ekleme formundaki dropdown seçeneklerini burada yönetin.
              Bir kategori seçip yeni bir değer ekleyebilirsiniz.
            </div>
          )}
        </div>
      </div>

      <form className="ayarlar-form" onSubmit={handleSubmit} noValidate>
        <label className="ayarlar-alan">
          <span className="ayarlar-etiket">Kategori</span>
          <select
            className="ayarlar-kutu"
            value={kategori}
            onChange={(olay) => setKategori(olay.target.value)}
          >
            {SECENEK_KATEGORILERI.map((secenekKategorisi) => (
              <option key={secenekKategorisi.kimlik} value={secenekKategorisi.kimlik}>
                {secenekKategorisi.etiket}
              </option>
            ))}
          </select>
        </label>

        <label className="ayarlar-alan">
          <span className="ayarlar-etiket">Değer</span>
          <input
            className="ayarlar-kutu"
            type="text"
            value={deger}
            onChange={(olay) => setDeger(olay.target.value)}
            placeholder="Eklenecek değer"
          />
        </label>

        <button type="submit" className="birincil-buton" disabled={eklePasif}>
          {ekleMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
        </button>
      </form>

      {ekleMutation.isError && (
        <div className="ayarlar-hata" role="alert">
          {ekleMutation.error?.message ||
            'Seçenek eklenemedi. Lütfen tekrar deneyin.'}
        </div>
      )}

      {silMutation.isError && (
        <div className="ayarlar-hata" role="alert">
          {silMutation.error?.message ||
            'Seçenek silinemedi. Lütfen tekrar deneyin.'}
        </div>
      )}

      <div className="ayarlar-liste">
        {isPending && <p className="ayarlar-durum">Yükleniyor...</p>}

        {isError && (
          <p className="ayarlar-durum ayarlar-durum-hata">{error.message}</p>
        )}

        {!isPending &&
          !isError &&
          SECENEK_KATEGORILERI.map((secenekKategorisi) => {
            const degerler = gruplandirilmis[secenekKategorisi.kimlik] ?? []
            return (
              <div key={secenekKategorisi.kimlik} className="ayarlar-grup">
                <h3 className="ayarlar-grup-baslik">
                  {secenekKategorisi.etiket}
                </h3>
                {degerler.length === 0 ? (
                  <p className="ayarlar-durum">Henüz seçenek eklenmedi.</p>
                ) : (
                  <ul className="ayarlar-deger-listesi">
                    {degerler.map((tekDeger) => (
                      <li key={tekDeger} className="ayarlar-deger">
                        <span>{tekDeger}</span>
                        <button
                          type="button"
                          className="ayarlar-deger-sil"
                          aria-label={`${tekDeger} seçeneğini sil`}
                          disabled={silMutation.isPending}
                          onClick={() =>
                            handleSil(secenekKategorisi.kimlik, tekDeger)
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
      </div>
    </section>
  )
}

export default AyarlarSayfasi
