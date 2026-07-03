// Parola giriş alanı bileşeni. Metin kutusuna ek olarak, sağ içinde kendi
// çizilen bir göz SVG'si ile parolayı göster/gizle özelliğini yönetir.
// Yalnızca girdi toplar ve görünürlüğü değiştirir; iş mantığı içermez.
import { useState } from 'react'

// EyeIcon: parola görünürlüğüne göre açık göz veya üzeri çizili göz çizer.
// gorunuyor=true iken "gizle" anlamında üzeri çizili göz gösterilir.
function EyeIcon({ gorunuyor }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      {gorunuyor && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

// PasswordField: kontrollü parola input'u.
// props: deger, alanDegisince(yeniDeger), yerTutucu (placeholder + aria-label)
function PasswordField({ deger, alanDegisince, yerTutucu }) {
  const [sifreGorunuyor, setSifreGorunuyor] = useState(false)

  // toggleSifreGoster: parolanın açık metin / gizli gösterimini değiştirir.
  function toggleSifreGoster() {
    setSifreGorunuyor((oncekiDurum) => !oncekiDurum)
  }

  return (
    <div className="form-alan">
      <div className="parola-sarmalayici">
        <input
          id="parola"
          className="form-input parola-input"
          type={sifreGorunuyor ? 'text' : 'password'}
          value={deger}
          onChange={(olay) => alanDegisince(olay.target.value)}
          placeholder={yerTutucu}
          aria-label={yerTutucu}
          autoComplete="current-password"
        />
        <button
          type="button"
          className="goz-buton"
          onClick={toggleSifreGoster}
          aria-label={sifreGorunuyor ? 'Parolayı gizle' : 'Parolayı göster'}
        >
          <EyeIcon gorunuyor={sifreGorunuyor} />
        </button>
      </div>
    </div>
  )
}

export default PasswordField
