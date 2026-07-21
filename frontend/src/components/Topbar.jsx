// Üst bar bileşeni. Anasayfanın en üstünde yer alan kalın yatay çubuktur.
// Sol tarafında anasayfaya (/) götüren "AKADEMİ" marka/logo alanını, sağ
// tarafında kişi menüsünü (KisiMenu) ve en sağda admin panelini açıp kapatan
// hamburger butonunu barındırır. Yalnızca gösterim ve etkileşim toplama
// sorumluluğundadır; iş mantığı içermez.
import { Link } from 'react-router-dom'
import KisiMenu from './KisiMenu.jsx'

// HamburgerIcon: üç yatay çizgiden oluşan menü simgesini çizer.
function HamburgerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

// Topbar: kişi menüsü ve hamburger butonunu yerleştirir.
// props:
//   adminMi -> yönetim panelinin giriş noktası olan hamburger butonunu yalnızca
//     admin kullanıcıya göstermek için kullanılır (gösterim kararı).
//   adminPaneliniDegistir() -> hamburger tıklanınca paneli açar/kapatır.
//   adminPaneliniKapat() -> kişi menüsü açılınca admin panelini kapatmak için
//     KisiMenu'ye geçilir (dropdown panelin arkasında kalmasın diye).
function Topbar({ adminMi, adminPaneliniDegistir, adminPaneliniKapat }) {
  return (
    <header className="ust-bar">
      <Link to="/" className="ust-bar-logo" aria-label="Anasayfaya git">
        AKADEMİ
      </Link>
      <div className="ust-bar-sag">
        <KisiMenu adminPaneliniKapat={adminPaneliniKapat} />
        {adminMi && (
          <button
            type="button"
            className="hamburger-buton"
            onClick={adminPaneliniDegistir}
            aria-label="Yönetim panelini aç/kapat"
          >
            <HamburgerIcon />
          </button>
        )}
      </div>
    </header>
  )
}

export default Topbar
