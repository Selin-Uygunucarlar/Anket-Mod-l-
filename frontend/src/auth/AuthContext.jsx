// Oturum bağlamı (auth context). Uygulama genelinde "kim giriş yapmış" bilgisini
// tek yerden sağlar. Kimlik httpOnly cookie'de ve doğrulama sunucuda olduğundan
// burada token/kullanıcı tarayıcı depolamasına (localStorage/sessionStorage)
// YAZILMAZ; oturum her açılışta sunucudan (me) tazelenir. İş kuralı içermez.
import { createContext, useContext, useEffect, useState } from 'react'
import { me, logout } from '../api/authApi.js'

// Bağlam nesnesi; useAuth ile tüketilir.
const AuthContext = createContext(null)

// AuthProvider: oturum durumunu tutar ve alt ağaca sağlar.
// yukleniyor, ilk me() çözülene kadar true kalır (refresh'te oturum korunur).
export function AuthProvider({ children }) {
  const [oturumKullanici, setOturumKullanici] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)

  // Uygulama açılışında bir kez oturumu sunucudan hydrate eder.
  // me() null dönerse (giriş yok/geçersiz) kullanıcı null kalır; bu bir hata
  // değildir. Ağ hatasında da UI kilitlenmesin diye giriş yapılmamış sayılır.
  useEffect(() => {
    let iptalEdildi = false

    async function oturumuYukle() {
      try {
        const kullanici = await me()
        if (!iptalEdildi) {
          setOturumKullanici(kullanici)
        }
      } catch {
        // Sunucuya ulaşılamadı vb. — giriş yapılmamış kabul edilir.
        if (!iptalEdildi) {
          setOturumKullanici(null)
        }
      } finally {
        if (!iptalEdildi) {
          setYukleniyor(false)
        }
      }
    }

    oturumuYukle()
    return () => {
      iptalEdildi = true
    }
  }, [])

  // girisYap: başarılı login sonrası bağlamı doldurur (istek zaten yapılmıştır).
  function girisYap(kullanici) {
    setOturumKullanici(kullanici)
  }

  // oturumuTazele: oturum durumunu sunucudan (me) yeniden çeker ve bağlamı
  // günceller. Örn. kullanıcı kalıcı şifresini belirleyince sifre_degistirilmeli
  // bayrağının tazelenmesi için çağrılır (tek gerçek kaynak sunucudur;
  // istemci depolamasına yazılmaz). me() null dönerse oturum yok sayılır.
  async function oturumuTazele() {
    const kullanici = await me()
    setOturumKullanici(kullanici)
  }

  // cikisYap: sunucudaki oturumu sonlandırır ve bağlamı temizler.
  async function cikisYap() {
    try {
      await logout()
    } finally {
      // Sunucu yanıtından bağımsız olarak istemci bağlamı her durumda temizlenir.
      setOturumKullanici(null)
    }
  }

  const deger = {
    oturumKullanici,
    yukleniyor,
    girisYap,
    oturumuTazele,
    cikisYap,
  }
  return <AuthContext.Provider value={deger}>{children}</AuthContext.Provider>
}

// useAuth: oturum bağlamını tüketmenin tek yolu. Provider dışında kullanılırsa
// hata fırlatır (yanlış kullanımı erken yakalar).
export function useAuth() {
  const baglam = useContext(AuthContext)
  if (baglam === null) {
    throw new Error('useAuth yalnızca AuthProvider içinde kullanılabilir.')
  }
  return baglam
}
