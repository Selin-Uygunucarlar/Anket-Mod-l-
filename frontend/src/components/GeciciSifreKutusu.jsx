// Başarılı kullanıcı kaydından sonra üretilen geçici şifreyi bir kez, kopyalanabilir
// düz metin olarak gösteren sunum bileşeni. Şifre yalnızca kayıt yanıtından gelir;
// localStorage'a/loga veya başka bir kalıcı yere YAZILMAZ. Yalnızca gösterim
// sorumluluğundadır; iş kuralı içermez. Stilleri kullanici-ekle.css'ten miras alır.

import { useState } from 'react'

// GeciciSifreKutusu: geçici şifreyi ve kopyalama kolaylığını gösterir.
// props: kullaniciKodu, geciciSifre, onGeriDon() -> listeye dönüş için çağrılır.
function GeciciSifreKutusu({ kullaniciKodu, geciciSifre, onGeriDon }) {
  const [kopyalandi, setKopyalandi] = useState(false)

  // kopyala: geçici şifreyi panoya kopyalar (destekleniyorsa). Sadece UX
  // kolaylığıdır; başarısız olursa kullanıcı metni elle seçebilir.
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(geciciSifre)
      setKopyalandi(true)
    } catch {
      // Pano API'si yoksa/engelliyse sessiz kal; metin zaten seçilebilir.
      setKopyalandi(false)
    }
  }

  return (
    <div className="kullanici-ekle-sonuc" role="status">
      <h3 className="kullanici-ekle-sonuc-baslik">Kullanıcı oluşturuldu</h3>
      <p className="kullanici-ekle-sonuc-metin">
        <strong>{kullaniciKodu}</strong> kodlu kullanıcı için geçici şifre
        üretildi. Bu şifreyi kullanıcıya iletin; kullanıcı ilk girişte kendi
        şifresini belirleyecek.
      </p>
      <div className="gecici-sifre-satiri">
        <input
          className="gecici-sifre-kutu"
          type="text"
          value={geciciSifre}
          readOnly
          onFocus={(olay) => olay.target.select()}
          aria-label="Geçici şifre"
        />
        <button type="button" className="ikincil-buton" onClick={kopyala}>
          {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <button type="button" className="birincil-buton" onClick={onGeriDon}>
        Kullanıcı Listesine Dön
      </button>
    </div>
  )
}

export default GeciciSifreKutusu
