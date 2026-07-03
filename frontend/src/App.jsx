// Uygulamanın en üst bileşeni. Şu an yalnızca giriş ekranını gösterir;
// ileride yönlendirme (router) eklenirse ekranlar buradan dallanır.
import LoginPage from './pages/LoginPage.jsx'

// Kök bileşen: aktif ekranı render eder.
function App() {
  return <LoginPage />
}

export default App
