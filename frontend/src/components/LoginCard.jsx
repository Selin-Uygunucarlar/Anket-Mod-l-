// Giriş kartı bileşeni. Logo placeholder, kimlik alanı (sicil kodu / e-posta),
// parola alanı, giriş butonu ve "parolamı unuttum" bağlantısını bir araya
// getirir. Yalnızca girdi toplar ve durumu gösterir; kimlik doğrulama işi
// useLogin hook'u aracılığıyla API katmanına devredilir.
import { useState } from 'react'
import PasswordField from './PasswordField.jsx'
import { useLogin } from '../hooks/useLogin.js'

// LoginCard: giriş formunu yönetir (girdi toplama + durum gösterimi).
function LoginCard() {
  const [kimlik, setKimlik] = useState('')
  const [sifre, setSifre] = useState('')
  const [alanHatalari, setAlanHatalari] = useState({ kimlik: '', sifre: '' })
  const loginMutation = useLogin()

  // validateInputs: yalnızca boş alan kontrolü yapar (UX amaçlı anlık geri
  // bildirim). Asıl doğrulama sunucuda yapılır. Hatasızsa true döner.
  function validateInputs() {
    const yeniHatalar = {
      kimlik: kimlik.trim() ? '' : 'Bu alan zorunludur.',
      sifre: sifre ? '' : 'Bu alan zorunludur.',
    }
    setAlanHatalari(yeniHatalar)
    return !yeniHatalar.kimlik && !yeniHatalar.sifre
  }

  // handleSubmit: form gönderimini karşılar; boş alanları engeller ve geçerliyse
  // giriş mutation'ını tetikler (gerçek istek API katmanındaki stub'a gider).
  function handleSubmit(olay) {
    olay.preventDefault()
    if (!validateInputs()) {
      return
    }
    loginMutation.mutate({ kimlik: kimlik.trim(), sifre })
  }

  return (
    <div className="login-kart">
      <div className="logo-placeholder">LOGO</div>

      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <div className="form-alan">
          <input
            id="kimlik"
            className="form-input"
            type="text"
            value={kimlik}
            onChange={(olay) => setKimlik(olay.target.value)}
            placeholder="Sicil Kodu / E-posta Adresi"
            aria-label="Sicil Kodu / E-posta Adresi"
            autoComplete="username"
          />
          {alanHatalari.kimlik && (
            <span className="alan-hata">{alanHatalari.kimlik}</span>
          )}
        </div>

        <PasswordField
          deger={sifre}
          alanDegisince={setSifre}
          yerTutucu="Parola"
        />
        {alanHatalari.sifre && (
          <span className="alan-hata">{alanHatalari.sifre}</span>
        )}

        {loginMutation.isError && (
          <div className="genel-hata" role="alert">
            Giriş yapılamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.
          </div>
        )}

        <button
          type="submit"
          className="giris-buton"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </form>

      <a className="parola-unuttum" href="#">
        Parolamı unuttum
      </a>
    </div>
  )
}

export default LoginCard
