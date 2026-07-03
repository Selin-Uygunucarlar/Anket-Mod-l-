// Anasayfa. Üstte kalın bir üst bar (Topbar), en sağda hamburger ile açılan
// sağdan kayan admin paneli (AdminPaneli) ve barın altında ileride doldurulacak
// boş bir içerik alanı içerir. Korumalı bir rotadır (yalnızca oturumu olan
// kullanıcı görebilir). Admin panelinin açık/kapalı durumu burada saf UI
// state olarak tutulur; iş kuralı/hesaplama içermez.
import { useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import AdminPaneli from '../components/AdminPaneli.jsx'
import '../styles/anasayfa.css'

// AnaSayfaPage: üst bar + içerik alanı + admin panelini birleştirir.
function AnaSayfaPage() {
  const [adminPaneliAcik, setAdminPaneliAcik] = useState(false)

  // toggleAdminPaneli: hamburger tıklanınca paneli açar/kapatır.
  function toggleAdminPaneli() {
    setAdminPaneliAcik((oncekiDurum) => !oncekiDurum)
  }

  // kapatAdminPaneli: kapatma butonu veya overlay ile paneli kapatır.
  function kapatAdminPaneli() {
    setAdminPaneliAcik(false)
  }

  return (
    <div className="anasayfa">
      <Topbar
        adminPaneliniDegistir={toggleAdminPaneli}
        adminPaneliniKapat={kapatAdminPaneli}
      />

      <main className="anasayfa-icerik">{/* İçerik ileride eklenecek */}</main>

      <AdminPaneli acik={adminPaneliAcik} panelKapat={kapatAdminPaneli} />
    </div>
  )
}

export default AnaSayfaPage
