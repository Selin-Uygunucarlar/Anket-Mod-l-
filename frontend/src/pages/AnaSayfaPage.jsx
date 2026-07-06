// Anasayfa. Üstte kalın bir üst bar (Topbar), en sağda hamburger ile açılan
// sağdan kayan admin paneli (AdminPaneli) ve barın altında seçilen görünüme
// göre değişen bir içerik alanı içerir. Korumalı bir rotadır (yalnızca oturumu
// olan kullanıcı görebilir). Admin panelinin açık/kapalı durumu ve seçili
// içerik görünümü burada saf UI state olarak tutulur; iş kuralı/hesaplama
// içermez. Yönetim paneli girişi (hamburger + panel + admin görünümleri) yalnızca
// kullanıcı türü 'admin' olduğunda gösterilir; bu bir gösterim kararıdır, gerçek
// yetki kontrolü sunucudadır.
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import Topbar from '../components/Topbar.jsx'
import AdminPaneli from '../components/AdminPaneli.jsx'
import KullaniciListesi from '../components/KullaniciListesi.jsx'
import KullaniciEkleForm from '../components/KullaniciEkleForm.jsx'
import AyarlarSayfasi from '../components/AyarlarSayfasi.jsx'
import KisiDetayPaneli from '../components/KisiDetayPaneli.jsx'
import '../styles/anasayfa.css'

// AnaSayfaPage: üst bar + içerik alanı + admin panelini birleştirir.
function AnaSayfaPage() {
  const { oturumKullanici } = useAuth()
  // adminMi: sunucunun döndürdüğü kullanıcı türünü yansıtan saf gösterim kararı.
  // Yönetim paneli girişini ve admin görünümlerini göster/gizle için kullanılır.
  const adminMi = oturumKullanici?.kullanici_turu === 'admin'
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
        adminMi={adminMi}
        adminPaneliniDegistir={toggleAdminPaneli}
        adminPaneliniKapat={kapatAdminPaneli}
      />

      <main className="anasayfa-icerik">
        {/* Admin görünümleri yalnızca admin'e; savunma derinliği olarak içerik
            de adminMi ile koşullanır, aksi halde boş anasayfa gösterilir. */}
        {adminMi && secilenGorunum === 'kullanici-listesi' && (
          <KullaniciListesi
            onKisiSec={setSecilenKisi}
            onKullaniciEkle={() => secGorunum('kullanici-ekle')}
          />
        )}
        {adminMi && secilenGorunum === 'kullanici-ekle' && (
          <KullaniciEkleForm
            onGeriDon={() => secGorunum('kullanici-listesi')}
          />
        )}
        {adminMi && secilenGorunum === 'ayarlar' && <AyarlarSayfasi />}
        {(!adminMi || secilenGorunum === null) && (
          <div className="anasayfa-bos">{/* İçerik ileride eklenecek */}</div>
        )}
      </main>

      {adminMi && (
        <AdminPaneli
          acik={adminPaneliAcik}
          panelKapat={kapatAdminPaneli}
          onSecenekSec={secGorunum}
        />
      )}

      <KisiDetayPaneli
        acik={Boolean(secilenKisi)}
        kisi={secilenKisi}
        panelKapat={() => setSecilenKisi(null)}
      />
    </div>
  )
}

export default AnaSayfaPage
