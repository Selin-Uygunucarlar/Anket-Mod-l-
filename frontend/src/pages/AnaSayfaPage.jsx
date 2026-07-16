// Anasayfa. Üstte kalın bir üst bar (Topbar), solda kalıcı kullanıcı yan çubuğu
// (KullaniciYanCubugu), en sağda hamburger ile açılan sağdan kayan admin paneli
// (AdminPaneli) ve barın altında seçilen görünüme göre değişen bir içerik alanı
// içerir. Korumalı bir rotadır (yalnızca oturumu olan kullanıcı görebilir). Admin
// panelinin açık/kapalı durumu, sol yan çubuğun genişletilmiş/daraltılmış durumu
// ve seçili içerik görünümü burada saf UI state olarak tutulur; iş kuralı/hesaplama
// içermez. Sol yan çubuk oturumu olan HER kullanıcıya gösterilir. Yönetim paneli
// girişi (hamburger + panel + admin görünümleri) yalnızca kullanıcı türü 'admin'
// olduğunda gösterilir; bu bir gösterim kararıdır, gerçek yetki kontrolü sunucudadır.
// İçerik alanının en üstünde, seçili görünümün menüdeki yerini bildiren kırıntı
// yolu (KirintiYolu) tek bir yerde gösterilir.
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import Topbar from '../components/Topbar.jsx'
import AdminPaneli from '../components/AdminPaneli.jsx'
import KullaniciYanCubugu from '../components/KullaniciYanCubugu.jsx'
import KullaniciListesi from '../components/KullaniciListesi.jsx'
import AnketListesi from '../components/AnketListesi.jsx'
import SoruListesi from '../components/SoruListesi.jsx'
import AnketEkleForm from '../components/AnketEkleForm.jsx'
import SoruEkleForm from '../components/SoruEkleForm.jsx'
import KullaniciEkleForm from '../components/KullaniciEkleForm.jsx'
import AyarlarSayfasi from '../components/AyarlarSayfasi.jsx'
import GrupTanimlariAyar from '../components/GrupTanimlariAyar.jsx'
import KullaniciGruplariSayfasi from '../components/KullaniciGruplariSayfasi.jsx'
import KisiDetayPaneli from '../components/KisiDetayPaneli.jsx'
import KirintiYolu from '../components/KirintiYolu.jsx'
import {
  SECENEK_KATEGORILERI,
  SORU_SECENEK_KATEGORILERI,
} from '../common/secenekKategorileri.js'
import { gorunumYolunuBul } from '../common/yonetimMenusu.js'
import '../styles/anasayfa.css'

// AnaSayfaPage: üst bar + içerik alanı + admin panelini birleştirir.
function AnaSayfaPage() {
  const { oturumKullanici } = useAuth()
  // adminMi: sunucunun döndürdüğü kullanıcı türünü yansıtan saf gösterim kararı.
  // Yönetim paneli girişini ve admin görünümlerini göster/gizle için kullanılır.
  const adminMi = oturumKullanici?.kullanici_turu === 'admin'
  const [adminPaneliAcik, setAdminPaneliAcik] = useState(false)
  // Sol kullanıcı yan çubuğunun genişletilmiş/daraltılmış durumunu tutan saf UI
  // state'i. Varsayılan daraltılmış (false); içerik alanının sol marjı bu duruma
  // göre kaydığından durum burada tutulup çubuğa props ile geçirilir.
  const [yanCubukGenis, setYanCubukGenis] = useState(false)
  // İçerik alanında hangi görünümün gösterileceğini tutan saf UI state'i.
  // null = henüz seçim yok (boş anasayfa).
  const [secilenGorunum, setSecilenGorunum] = useState(null)
  // Kişi detay panelinde gösterilecek kişiyi tutan saf UI state'i.
  // null = panel kapalı; { kullanici_kodu, ad, soyad } = ilgili kişinin detayı
  // açık. kullanici_kodu, panelin detayı backend'den çekmesi için taşınır.
  const [secilenKisi, setSecilenKisi] = useState(null)
  // Düzenleme görünümünde düzenlenecek kullanıcının liste özetini tutan saf UI
  // state'i. null iken düzenleme görünümü açık değildir; form mevcut alanları
  // sicil koduyla backend'den kendisi çeker.
  const [duzenlenecekKullanici, setDuzenlenecekKullanici] = useState(null)
  // Düzenleme görünümünde düzenlenecek sorunun liste özetini tutan saf UI state'i.
  // null iken soru düzenleme görünümü açık değildir; form mevcut alanları soru_id
  // ile backend'den kendisi çeker (kullanıcı düzenleme kalıbıyla aynı).
  const [duzenlenecekSoru, setDuzenlenecekSoru] = useState(null)
  // Düzenleme görünümünde düzenlenecek anketin liste özetini tutan saf UI state'i.
  // null iken anket düzenleme görünümü açık değildir; form mevcut alanları anket_id
  // ile backend'den kendisi çeker (soru/kullanıcı düzenleme kalıbıyla aynı).
  const [duzenlenecekAnket, setDuzenlenecekAnket] = useState(null)

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

  // secGorunum: bir menü yaprağı bir görünüm seçince çağrılır; içerik alanını
  // günceller ve paneli kapatır.
  function secGorunum(gorunumKimligi) {
    setSecilenGorunum(gorunumKimligi)
    setAdminPaneliAcik(false)
  }

  // kullaniciDuzenlemeyiAc: listeden bir kullanıcının "Düzenle" öğesi seçilince
  // çağrılır; düzenlenecek kullanıcıyı belirler ve düzenleme görünümünü açar.
  function kullaniciDuzenlemeyiAc(kullanici) {
    setDuzenlenecekKullanici(kullanici)
    setSecilenGorunum('kullanici-duzenle')
  }

  // kullaniciListesineDon: ekleme/düzenleme ekranından listeye döner ve varsa
  // düzenleme hedefini temizler (bir sonraki açılış temiz başlasın).
  function kullaniciListesineDon() {
    setDuzenlenecekKullanici(null)
    secGorunum('kullanici-listesi')
  }

  // soruDuzenlemeyiAc: soru listesindeki bir satırın "Güncelle" butonu tıklanınca
  // çağrılır; düzenlenecek soruyu belirler ve soru düzenleme görünümünü açar.
  function soruDuzenlemeyiAc(soru) {
    setDuzenlenecekSoru(soru)
    setSecilenGorunum('soru-duzenle')
  }

  // soruListesineDon: soru düzenleme ekranından listeye döner ve düzenleme hedefini
  // temizler (bir sonraki açılış temiz başlasın).
  function soruListesineDon() {
    setDuzenlenecekSoru(null)
    secGorunum('anket-sorulari')
  }

  // anketDuzenlemeyiAc: anket listesindeki bir satırın "Güncelle" butonu tıklanınca
  // çağrılır; düzenlenecek anketi belirler ve anket düzenleme görünümünü açar.
  function anketDuzenlemeyiAc(anket) {
    setDuzenlenecekAnket(anket)
    setSecilenGorunum('anket-duzenle')
  }

  // anketListesineDon: anket ekleme/düzenleme ekranından listeye döner ve düzenleme
  // hedefini temizler (bir sonraki açılış temiz başlasın).
  function anketListesineDon() {
    setDuzenlenecekAnket(null)
    secGorunum('anket-listesi')
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
        {/* Seçili görünümün menüdeki yeri; boş anasayfada ve admin olmayan
            kullanıcıda gösterilecek bir yol yoktur. */}
        {adminMi && <KirintiYolu basliklar={gorunumYolunuBul(secilenGorunum)} />}

        {/* Admin görünümleri yalnızca admin'e; savunma derinliği olarak içerik
            de adminMi ile koşullanır, aksi halde boş anasayfa gösterilir. */}
        {adminMi && secilenGorunum === 'kullanici-listesi' && (
          <KullaniciListesi
            onKisiSec={setSecilenKisi}
            onKullaniciEkle={() => secGorunum('kullanici-ekle')}
            onKullaniciDuzenle={kullaniciDuzenlemeyiAc}
          />
        )}
        {adminMi && secilenGorunum === 'kullanici-ekle' && (
          <KullaniciEkleForm onGeriDon={kullaniciListesineDon} />
        )}
        {adminMi && secilenGorunum === 'kullanici-duzenle' && duzenlenecekKullanici && (
          <KullaniciEkleForm
            duzenlenecekKullanici={duzenlenecekKullanici}
            onGeriDon={kullaniciListesineDon}
          />
        )}
        {adminMi && secilenGorunum === 'anket-listesi' && (
          <AnketListesi
            onAnketEkle={() => secGorunum('anket-ekle')}
            onAnketDuzenle={anketDuzenlemeyiAc}
          />
        )}
        {adminMi && secilenGorunum === 'anket-ekle' && (
          <AnketEkleForm onGeriDon={() => secGorunum('anket-listesi')} />
        )}
        {adminMi && secilenGorunum === 'anket-duzenle' && duzenlenecekAnket && (
          <AnketEkleForm
            duzenlenecekAnketId={duzenlenecekAnket.anket_id}
            onGeriDon={anketListesineDon}
          />
        )}
        {adminMi && secilenGorunum === 'anket-sorulari' && (
          <SoruListesi
            onSoruEkle={() => secGorunum('soru-ekle')}
            onSoruDuzenle={soruDuzenlemeyiAc}
          />
        )}
        {adminMi && secilenGorunum === 'soru-ekle' && (
          <SoruEkleForm onGeriDon={() => secGorunum('anket-sorulari')} />
        )}
        {adminMi && secilenGorunum === 'soru-duzenle' && duzenlenecekSoru && (
          <SoruEkleForm
            duzenlenecekSoru={duzenlenecekSoru}
            onGeriDon={soruListesineDon}
          />
        )}
        {adminMi && secilenGorunum === 'ayarlar' && (
          <AyarlarSayfasi
            baslik="Kullanıcı Seçenek Tanımları"
            aciklama="Kullanıcı ekleme formundaki dropdown seçeneklerini burada yönetin. Bir kategori seçip yeni bir değer ekleyebilirsiniz."
            kategoriler={SECENEK_KATEGORILERI}
          />
        )}
        {adminMi && secilenGorunum === 'soru-ayarlar' && (
          <AyarlarSayfasi
            baslik="Soru Seçenek Tanımları"
            aciklama="Anket sorusu ekleme formundaki Konu ve Amaç dropdown seçeneklerini burada yönetin. Bir kategori seçip yeni bir değer ekleyebilirsiniz."
            kategoriler={SORU_SECENEK_KATEGORILERI}
          />
        )}
        {adminMi && secilenGorunum === 'kullanici-gruplari' && (
          <KullaniciGruplariSayfasi />
        )}
        {adminMi && secilenGorunum === 'grup-ayarlar' && <GrupTanimlariAyar />}
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
