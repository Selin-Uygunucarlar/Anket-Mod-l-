// Grup Tanımları ayar bileşeni. Admin panelinden "Grup Tanımları" seçilince
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// admin'in kullanıcı gruplarını (Yönetici, Mühendis, Tekniker...) eklemesi,
// üye sayılarıyla listelemesi ve silmesi (onay sonrası). Girdi toplar ve grupApi
// üzerinden ister/ekler/siler; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki ve
// asıl doğrulama sunucuda). Boş adda Ekle pasiftir (yalnızca UX). Hata durumunda
// (zaten var olan grup adı dahil) yalnızca backend'in güvenli mesajı gösterilir;
// teknik detay sızmaz. Görsel üslup AyarlarSayfasi ile birebir tutarlıdır.

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listGruplar, ekleGrup, silGrup } from '../api/grupApi.js'
import OnayKutusu from './OnayKutusu.jsx'
import '../styles/ayarlar.css'

// Başlık yanındaki bilgi (ⓘ) baloncuğunda gösterilecek açıklama metni.
const ACIKLAMA_METNI =
  'Kullanıcı gruplarını (ör. Yönetici, Mühendis, Tekniker) burada tanımlayın. ' +
  'Grupların üyelerini "Kullanıcı Grupları" ekranından yönetebilirsiniz. Bir ' +
  'grubu silerseniz üyeleri grupsuz kalır.'

// GrupTanimlariAyar: grup ekleme formu + mevcut grupların üye sayılı listesi.
function GrupTanimlariAyar() {
  const [ad, setAd] = useState('')
  // Başlık yanındaki bilgi düğmesiyle açılan açıklama baloncuğunun durumu.
  const [aciklamaAcik, setAciklamaAcik] = useState(false)
  // Silme onay kutusunun hedefi olan grup (null iken onay kutusu kapalı).
  const [silinecekGrup, setSilinecekGrup] = useState(null)
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
    data: gruplar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['gruplar'],
    queryFn: listGruplar,
  })

  const ekleMutation = useMutation({
    mutationFn: (grupAdi) => ekleGrup(grupAdi),
    onSuccess: () => {
      // Liste tazelensin ve eklenen grup görünsün.
      queryClient.invalidateQueries({ queryKey: ['gruplar'] })
      setAd('')
    },
  })

  const silMutation = useMutation({
    mutationFn: (grupId) => silGrup(grupId),
    onSuccess: () => {
      // Silinen grup listeden kalksın.
      queryClient.invalidateQueries({ queryKey: ['gruplar'] })
      setSilinecekGrup(null)
    },
    onError: () => {
      // Onay kutusunu kapat; güvenli hata mesajı liste üstünde gösterilir.
      setSilinecekGrup(null)
    },
  })

  // handleSubmit: grup ekleme isteğini gönderir. Boş adda buton pasif olduğundan
  // burada ek doğrulama yapılmaz (client-side kontrol yalnızca UX); istek API'ye iletilir.
  function handleSubmit(olay) {
    olay.preventDefault()
    if (ad.trim() === '') {
      return
    }
    ekleMutation.mutate(ad.trim())
  }

  // silmeyiOnayla: onay kutusundaki onay butonuna basılınca hedef grubu siler.
  function silmeyiOnayla() {
    silMutation.mutate(silinecekGrup.grup_id)
  }

  const eklePasif = ad.trim() === '' || ekleMutation.isPending

  return (
    <section className="ayarlar">
      <div className="ayarlar-baslik-satiri">
        <h2 className="ayarlar-baslik">Grup Tanımları</h2>
        <div className="ayarlar-bilgi-sarmalayici" ref={bilgiSarmalayiciRef}>
          <button
            type="button"
            className="ayarlar-bilgi-dugmesi"
            aria-label="Grup Tanımları hakkında bilgi"
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
              {ACIKLAMA_METNI}
            </div>
          )}
        </div>
      </div>

      <form className="ayarlar-form" onSubmit={handleSubmit} noValidate>
        <label className="ayarlar-alan">
          <span className="ayarlar-etiket">Grup Adı</span>
          <input
            className="ayarlar-kutu"
            type="text"
            value={ad}
            onChange={(olay) => setAd(olay.target.value)}
            placeholder="Eklenecek grup adı"
          />
        </label>

        <button type="submit" className="birincil-buton" disabled={eklePasif}>
          {ekleMutation.isPending ? 'Ekleniyor...' : 'Ekle'}
        </button>
      </form>

      {ekleMutation.isError && (
        <div className="ayarlar-hata" role="alert">
          {ekleMutation.error?.message ||
            'Grup eklenemedi. Lütfen tekrar deneyin.'}
        </div>
      )}

      {silMutation.isError && (
        <div className="ayarlar-hata" role="alert">
          {silMutation.error?.message ||
            'Grup silinemedi. Lütfen tekrar deneyin.'}
        </div>
      )}

      <div className="ayarlar-liste">
        {isPending && <p className="ayarlar-durum">Yükleniyor...</p>}

        {isError && (
          <p className="ayarlar-durum ayarlar-durum-hata">{error.message}</p>
        )}

        {!isPending && !isError && (gruplar?.length ?? 0) === 0 && (
          <p className="ayarlar-durum">Henüz grup eklenmedi.</p>
        )}

        {!isPending && !isError && (gruplar?.length ?? 0) > 0 && (
          <ul className="ayarlar-satir-listesi">
            {gruplar.map((grup) => (
              <li key={grup.grup_id} className="ayarlar-satir">
                <span className="ayarlar-satir-ad">
                  {grup.ad}
                  <span className="ayarlar-satir-sayi">
                    {`${grup.uye_sayisi} üye`}
                  </span>
                </span>
                <button
                  type="button"
                  className="ayarlar-deger-sil"
                  aria-label={`${grup.ad} grubunu sil`}
                  disabled={silMutation.isPending}
                  onClick={() => setSilinecekGrup(grup)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {silinecekGrup && (
        <OnayKutusu
          baslik="Grubu sil"
          mesaj={`"${silinecekGrup.ad}" grubunu silmek istiyor musunuz? Grubun üyeleri grupsuz kalır.`}
          onaylaMetni="Sil"
          onOnayla={silmeyiOnayla}
          onVazgec={() => setSilinecekGrup(null)}
          islemAktif={silMutation.isPending}
        />
      )}
    </section>
  )
}

export default GrupTanimlariAyar
