// Giriş ekranının sayfa düzeni. Tam ekran arka plan görselini gösterir ve
// giriş kartını sol-orta konuma yerleştirir (görselin boş sol alanına oturur).
// Yalnızca yerleşimden sorumludur; form mantığı LoginCard içindedir.
import LoginCard from '../components/LoginCard.jsx'
import loginBackground from '../assets/login-bg.png'

// LoginPage: arka planı ve sol-orta hizalı kart yerleşimini kurar.
function LoginPage() {
  return (
    <div
      className="login-page"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <LoginCard />
    </div>
  )
}

export default LoginPage
