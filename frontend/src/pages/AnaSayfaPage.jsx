// Anasayfa. Üstte kalın bir üst bar (Topbar), en sağda hamburger ile açılan
// sağdan kayan admin paneli (AdminPaneli) ve barın altında seçilen görünüme
// göre değişen bir içerik alanı içerir. Korumalı bir rotadır (yalnızca oturumu
// olan kullanıcı görebilir). Admin panelinin açık/kapalı durumu ve seçili
// içerik görünümü burada saf UI state olarak tutulur; iş kuralı/hesaplama
// içermez.
import { useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import AdminPaneli from '../components/AdminPaneli.jsx'
import KullaniciListesi from '../components/KullaniciListesi.jsx'
import KisiDetayPaneli from '../components/KisiDetayPaneli.jsx'
import '../styles/anasayfa.css'

// AnaSayfaPage: üst bar + içerik alanı + admin panelini birleştirir.
function AnaSayfaPage() {
  const [adminPaneliAcik, setAdminPaneliAcik] = useState(false)
  // İçerik alanında hangi görünümün gösterileceğini tutan saf UI state'i.
  // null = henüz seçim yok (boş anasayfa).
  const [secilenGorunum, setSecilenGorunum] = useState(null)
  // Kişi detay panelinde gösterilecek kişiyi tutan saf UI state'i.
  // null = panel kapalı; { ad, soyad } = ilgili kişinin detayı açık.
  const [secilenKisi, setSecilenKisi] = useState(null)

  // toggleAdminPaneli: hamburger tıklanınca paneli açar/kapatır.
  function toggleAdminPaneli() {
    setAdminPaneliAcik((oncekiDurum) => !oncekiDurum)
  }

  // kapatAdminPaneli: kapatma butonu veya overlay ile paneli kapatır.
  function kapatAdminPaneli() {
    setAdminPaneliAcik(false)
  }

  // secGorunum: bir menü yaprağı bir görünüm seçince çağrılır; içerik alanını
  // günceller ve paneli kapatır.
  function secGorunum(gorunumKimligi) {
    setSecilenGorunum(gorunumKimligi)
    setAdminPaneliAcik(false)
  }

  return (
    <div className="anasayfa">
      <Topbar
        adminPaneliniDegistir={toggleAdminPaneli}
        adminPaneliniKapat={kapatAdminPaneli}
      />

      <main className="anasayfa-icerik">
        {secilenGorunum === 'kullanici-listesi' ? (
          <KullaniciListesi onKisiSec={setSecilenKisi} />
        ) : (
          <div className="anasayfa-bos">{/* İçerik ileride eklenecek */}</div>
        )}
      </main>

      <AdminPaneli
        acik={adminPaneliAcik}
        panelKapat={kapatAdminPaneli}
        onSecenekSec={secGorunum}
      />

      <KisiDetayPaneli
        acik={Boolean(secilenKisi)}
        kisi={secilenKisi}
        panelKapat={() => setSecilenKisi(null)}
      />
    </div>
  )
}

export default AnaSayfaPage
