// Anasayfa KABUĞU (layout). Üstte kalın bir üst bar (Topbar), solda kalıcı
// kullanıcı yan çubuğu (KullaniciYanCubugu), en sağda hamburger ile açılan sağdan
// kayan admin paneli (AdminPaneli) ve barın altında, aktif rotaya göre değişen bir
// içerik alanı (<Outlet/>) içerir. İç ekranlar artık gerçek URL rotalarıdır (App.jsx);
// böylece tarayıcının geri/ileri oku uygulama içinde çalışır. Bu kabuk yalnızca saf
// UI state tutar: admin panelinin açık/kapalı durumu, sol yan çubuğun genişletilmiş/
// daraltılmış durumu ve sağdan açılan kişi detay panelinin hedefi (secilenKisi).
// İş kuralı/hesaplama içermez. Sol yan çubuk oturumu olan HER kullanıcıya gösterilir.
// Yönetim paneli girişi (hamburger + panel) yalnızca kullanıcı türü 'admin' olduğunda
// gösterilir; bu bir gösterim kararıdır, gerçek yetki kontrolü sunucudadır. İçerik
// alanının en üstünde, aktif URL'den çözülen kırıntı yolu (KirintiYolu) tek bir yerde
// gösterilir. Liste ekranları kişi detay panelini Outlet context ile aldıkları
// onKisiSec üzerinden açar; panel state'i burada (kabukta) tutulur.
import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Topbar from '../components/Topbar.jsx'
import AdminPaneli from '../components/AdminPaneli.jsx'
import KullaniciYanCubugu from '../components/KullaniciYanCubugu.jsx'
import KisiDetayPaneli from '../components/KisiDetayPaneli.jsx'
import KirintiYolu from '../components/KirintiYolu.jsx'
import {
  gorunumYolunuBulDetayli,
  gorunumUrl,
  yoldanGorunumBul,
} from '../common/yonetimMenusu.js'
import '../styles/anasayfa.css'

// AnaSayfaPage: kabuk çerçevesini (üst bar + yan çubuk + admin paneli + kişi detay
// paneli) kurar ve içerik alanını aktif rotaya (<Outlet/>) bırakır.
function AnaSayfaPage() {
  const { oturumKullanici } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // adminMi: sunucunun döndürdüğü kullanıcı türünü yansıtan saf gösterim kararı.
  // Yönetim paneli girişini ve kırıntı yolunu göster/gizle için kullanılır.
  const adminMi = oturumKullanici?.kullanici_turu === 'admin'
  const [adminPaneliAcik, setAdminPaneliAcik] = useState(false)
  // Sol kullanıcı yan çubuğunun genişletilmiş/daraltılmış durumunu tutan saf UI
  // state'i. Varsayılan daraltılmış (false); içerik alanının sol marjı bu duruma
  // göre kaydığından durum burada tutulup çubuğa props ile geçirilir.
  const [yanCubukGenis, setYanCubukGenis] = useState(false)
  // Kişi detay panelinde gösterilecek kişiyi tutan saf UI state'i.
  // null = panel kapalı; { kullanici_kodu, ad, soyad } = ilgili kişinin detayı
  // açık. kullanici_kodu, panelin detayı backend'den çekmesi için taşınır.
  const [secilenKisi, setSecilenKisi] = useState(null)

  // Aktif URL'den çözülen görünüm kimliği; kırıntı yolunu bundan üretiriz.
  // Ana ekranda (eşleşme yok) null döner ve kırıntı yolu boş kalır.
  const aktifGorunum = yoldanGorunumBul(location.pathname)

  // toggleAdminPaneli: hamburger tıklanınca paneli açar/kapatır.
  function toggleAdminPaneli() {
    setAdminPaneliAcik((oncekiDurum) => !oncekiDurum)
  }

  // toggleYanCubuk: yan çubuğun aç/kapa butonu tıklanınca çubuğu genişletir/daraltır.
  function toggleYanCubuk() {
    setYanCubukGenis((oncekiDurum) => !oncekiDurum)
  }

  // kapatAdminPaneli: kapatma butonu veya overlay ile paneli kapatır.
  function kapatAdminPaneli() {
    setAdminPaneliAcik(false)
  }

  // gorunumeGit: admin panelindeki bir menü yaprağı seçilince çağrılır; görünüm
  // kimliğini URL'ye çevirip oraya gezinir ve paneli kapatır (gezinme kararı
  // eşlemeye dayanır; iş kuralı yok).
  function gorunumeGit(gorunumKimligi) {
    navigate(gorunumUrl(gorunumKimligi))
    setAdminPaneliAcik(false)
  }

  return (
    <div className="anasayfa">
      <Topbar
        adminMi={adminMi}
        adminPaneliniDegistir={toggleAdminPaneli}
        adminPaneliniKapat={kapatAdminPaneli}
      />

      <KullaniciYanCubugu genis={yanCubukGenis} durumDegistir={toggleYanCubuk} />

      <main
        className={`anasayfa-icerik${yanCubukGenis ? ' yan-cubuk-genis' : ''}`}
      >
        {/* Aktif rotanın menüdeki yeri; boş anasayfada ve admin olmayan
            kullanıcıda gösterilecek bir yol yoktur. Sayfa taşıyan ara segmentler
            tıklanabilir (bkz. KirintiYolu). */}
        {adminMi && <KirintiYolu ogeler={gorunumYolunuBulDetayli(aktifGorunum)} />}

        {/* İç ekranlar aktif rotaya göre burada render edilir. Liste ekranlarına
            kişi detay panelini açan onKisiSec context ile iletilir. */}
        <Outlet context={{ onKisiSec: setSecilenKisi }} />
      </main>

      {adminMi && (
        <AdminPaneli
          acik={adminPaneliAcik}
          panelKapat={kapatAdminPaneli}
          onSecenekSec={gorunumeGit}
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
