// Geçici (tek kullanımlık) şifreyle giren kullanıcının kendi kalıcı şifresini
// belirlediği zorunlu akış sayfası. Kullanıcı bu şifreyi belirlemeden anasayfayı
// kullanamaz (yönlendirme App.jsx'te sifre_degistirilmeli bayrağına göre yapılır).
// Yalnızca sunum sorumluluğundadır: iki parola alanı toplar ve sifreBelirle stub'ı
// ile backend'e iletir; iş kuralı/hesaplama İÇERMEZ. İki alanın eşleşmesi ve boş
// olmaması yalnızca UX içindir (Kaydet'i pasifleştirir); minimum uzunluk gibi asıl
// kurallar sunucudadır. Başarıda oturum sunucudan tazelenir ve anasayfaya geçilir.
// Hata durumunda yalnızca backend'in güvenli mesajı gösterilir.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { sifreBelirle } from '../api/authApi.js'
import { useAuth } from '../auth/AuthContext.jsx'
import '../styles/sifre-belirle.css'

// SifreBelirlePage: kalıcı şifre belirleme formunu yönetir.
function SifreBelirlePage() {
  const [yeniSifre, setYeniSifre] = useState('')
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('')
  const [gorunuyor, setGorunuyor] = useState(false)
  const { oturumuTazele } = useAuth()
  const navigate = useNavigate()

  const belirleMutation = useMutation({
    mutationFn: () => sifreBelirle(yeniSifre),
    onSuccess: async () => {
      // Bayrak (sifre_degistirilmeli) sunucudan tazelensin; sonra anasayfaya geç.
      await oturumuTazele()
      navigate('/', { replace: true })
    },
  })

  // Eşleşme/boşluk kontrolü yalnızca UX'tir; asıl doğrulama sunucudadır.
  const alanlarDolu = yeniSifre !== '' && yeniSifreTekrar !== ''
  const eslesiyor = yeniSifre === yeniSifreTekrar
  const kaydetPasif = !alanlarDolu || !eslesiyor || belirleMutation.isPending

  // handleSubmit: formu gönderir. Buton pasifken tetiklenmez; geçerliyse istek
  // API stub'ına iletilir.
  function handleSubmit(olay) {
    olay.preventDefault()
    if (kaydetPasif) {
      return
    }
    belirleMutation.mutate()
  }

  return (
    <div className="sifre-belirle-sayfa">
      <div className="sifre-belirle-kart">
        <h1 className="sifre-belirle-baslik">Şifrenizi Belirleyin</h1>
        <p className="sifre-belirle-aciklama">
          Geçici şifreyle giriş yaptınız. Devam etmek için kendi kalıcı şifrenizi
          belirleyin.
        </p>

        <form className="sifre-belirle-form" onSubmit={handleSubmit} noValidate>
          <label className="sifre-belirle-alan">
            <span className="sifre-belirle-etiket">Yeni Şifre</span>
            <input
              className="sifre-belirle-kutu"
              type={gorunuyor ? 'text' : 'password'}
              value={yeniSifre}
              onChange={(olay) => setYeniSifre(olay.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="sifre-belirle-alan">
            <span className="sifre-belirle-etiket">Yeni Şifre (Tekrar)</span>
            <input
              className="sifre-belirle-kutu"
              type={gorunuyor ? 'text' : 'password'}
              value={yeniSifreTekrar}
              onChange={(olay) => setYeniSifreTekrar(olay.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label className="sifre-belirle-goster">
            <input
              type="checkbox"
              checked={gorunuyor}
              onChange={(olay) => setGorunuyor(olay.target.checked)}
            />
            <span>Şifreyi göster</span>
          </label>

          {alanlarDolu && !eslesiyor && (
            <span className="sifre-belirle-uyari">
              Şifreler eşleşmiyor.
            </span>
          )}

          {belirleMutation.isError && (
            <div className="sifre-belirle-hata" role="alert">
              {belirleMutation.error?.message ||
                'Şifre belirlenemedi. Lütfen tekrar deneyin.'}
            </div>
          )}

          <button
            type="submit"
            className="sifre-belirle-buton"
            disabled={kaydetPasif}
          >
            {belirleMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default SifreBelirlePage
