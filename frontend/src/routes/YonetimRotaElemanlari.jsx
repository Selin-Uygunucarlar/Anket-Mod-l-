// Yönetim (ana ekran altı) rotalarının ince "rota elemanı" sarmalayıcıları. Her
// biri URL parametresini (useParams) ve gezinmeyi (useNavigate) okuyup MEVCUT
// içerik bileşenlerini değiştirmeden, bugünkü prop şekilleriyle render eder.
// Amaç: her iç ekran gerçek bir URL'ye bağlansın ki tarayıcının geri/ileri oku
// uygulama içinde çalışsın. Salt sunum/gezinme sorumluluğundadır; iş kuralı,
// hesaplama veya veri erişimi İÇERMEZ (bileşenler veriyi kendi api katmanından
// çeker). Liste bileşenlerine kişi detay panelini açan onKisiSec, kabuktan
// Outlet context ile gelir. Admin görünümlerine erişim AdminGuard ile UX olarak
// kısıtlanır; asıl yetki sunucudadır (savunma derinliği).

import { useNavigate, useParams, useOutletContext, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import KullaniciListesi from '../components/KullaniciListesi.jsx'
import KullaniciEkleForm from '../components/KullaniciEkleForm.jsx'
import AnketListesi from '../components/AnketListesi.jsx'
import AnketEkleForm from '../components/AnketEkleForm.jsx'
import SoruListesi from '../components/SoruListesi.jsx'
import SoruEkleForm from '../components/SoruEkleForm.jsx'
import KullaniciGruplariSayfasi from '../components/KullaniciGruplariSayfasi.jsx'
import AyarlarSayfasi from '../components/AyarlarSayfasi.jsx'
import GrupTanimlariAyar from '../components/GrupTanimlariAyar.jsx'
import AtanmisAnketPaneli from '../components/AtanmisAnketPaneli.jsx'
import {
  SECENEK_KATEGORILERI,
  SORU_SECENEK_KATEGORILERI,
} from '../common/secenekKategorileri.js'

// Ekleme/düzenleme ekranlarının başarı sonrası ve "Geri Dön"de döndüğü liste
// yolları. Add/edit/list sarmalayıcıları arasında tek yerde tutulur (yerel DRY).
const KULLANICI_LISTE_YOLU = '/yonetim/kullanicilar'
const ANKET_LISTE_YOLU = '/yonetim/anketler'
const SORU_LISTE_YOLU = '/yonetim/sorular'

// AdminGuard: yalnızca kullanıcı türü 'admin' ise children'ı render eder; değilse
// ana ekrana yönlendirir. Bu bir UX kısıtıdır (savunma derinliği); gerçek yetki
// kontrolü sunucudadır. Client'tan gelen role güvenilmez, sunucu her istekte doğrular.
export function AdminGuard({ children }) {
  const { oturumKullanici } = useAuth()
  if (oturumKullanici?.kullanici_turu !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}

// AnaEkranGorunumu: ana ekranın (index rota) içeriği; giriş yapan HERKESE (admin
// olsun olmasın) atanmış bekleyen anketleri gösteren paneli render eder.
export function AnaEkranGorunumu() {
  return (
    <div className="anasayfa-bos">
      <AtanmisAnketPaneli />
    </div>
  )
}

// KullaniciListesiRota: kullanıcı listesini gösterir; ekle/düzenle butonları ilgili
// URL'ye gezinir, kişi adına tıklama kabuğun detay panelini açar (Outlet context).
export function KullaniciListesiRota() {
  const navigate = useNavigate()
  const { onKisiSec } = useOutletContext()
  return (
    <KullaniciListesi
      onKisiSec={onKisiSec}
      onKullaniciEkle={() => navigate(`${KULLANICI_LISTE_YOLU}/ekle`)}
      onKullaniciDuzenle={(kullanici) =>
        navigate(`${KULLANICI_LISTE_YOLU}/${kullanici.kullanici_kodu}/duzenle`)
      }
    />
  )
}

// KullaniciEkleRota: kullanıcı ekleme formu; "Geri Dön" ve başarı sonrası listeye
// gezinir (form iç mantığı değişmez).
export function KullaniciEkleRota() {
  const navigate = useNavigate()
  return <KullaniciEkleForm onGeriDon={() => navigate(KULLANICI_LISTE_YOLU)} />
}

// KullaniciDuzenleRota: URL'deki sicil ile kullanıcı düzenleme formunu düzenleme
// modunda açar. Form yalnızca kullanici_kodu ile mevcut kaydı kendisi çeker; bu
// yüzden prop bugünkü şekliyle ({ kullanici_kodu }) verilir, iç mantık değişmez.
export function KullaniciDuzenleRota() {
  const navigate = useNavigate()
  const { sicil } = useParams()
  return (
    <KullaniciEkleForm
      duzenlenecekKullanici={{ kullanici_kodu: sicil }}
      onGeriDon={() => navigate(KULLANICI_LISTE_YOLU)}
    />
  )
}

// AnketListesiRota: anket listesini gösterir; ekle/güncelle butonları ilgili URL'ye gezinir.
export function AnketListesiRota() {
  const navigate = useNavigate()
  return (
    <AnketListesi
      onAnketEkle={() => navigate(`${ANKET_LISTE_YOLU}/ekle`)}
      onAnketDuzenle={(anket) =>
        navigate(`${ANKET_LISTE_YOLU}/${anket.anket_id}/duzenle`)
      }
    />
  )
}

// AnketEkleRota: anket oluşturma formu; "Geri Dön" ve başarı sonrası listeye gezinir.
export function AnketEkleRota() {
  const navigate = useNavigate()
  return <AnketEkleForm onGeriDon={() => navigate(ANKET_LISTE_YOLU)} />
}

// AnketDuzenleRota: URL'deki anketId ile anket güncelleme formunu açar. Form ID ile
// detayı kendisi çeker; prop bugünkü şekliyle (duzenlenecekAnketId) verilir.
export function AnketDuzenleRota() {
  const navigate = useNavigate()
  const { anketId } = useParams()
  return (
    <AnketEkleForm
      duzenlenecekAnketId={anketId}
      onGeriDon={() => navigate(ANKET_LISTE_YOLU)}
    />
  )
}

// SoruListesiRota: anket sorularını gösterir; ekle/güncelle butonları ilgili URL'ye gezinir.
export function SoruListesiRota() {
  const navigate = useNavigate()
  return (
    <SoruListesi
      onSoruEkle={() => navigate(`${SORU_LISTE_YOLU}/ekle`)}
      onSoruDuzenle={(soru) =>
        navigate(`${SORU_LISTE_YOLU}/${soru.soru_id}/duzenle`)
      }
    />
  )
}

// SoruEkleRota: soru ekleme formu; "Geri Dön" ve başarı sonrası listeye gezinir.
export function SoruEkleRota() {
  const navigate = useNavigate()
  return <SoruEkleForm onGeriDon={() => navigate(SORU_LISTE_YOLU)} />
}

// SoruDuzenleRota: URL'deki soruId ile soru düzenleme formunu açar. Form ID ile
// detayı kendisi çeker; prop bugünkü şekliyle (duzenlenecekSoru) verilir.
export function SoruDuzenleRota() {
  const navigate = useNavigate()
  const { soruId } = useParams()
  return (
    <SoruEkleForm
      duzenlenecekSoru={{ soru_id: soruId }}
      onGeriDon={() => navigate(SORU_LISTE_YOLU)}
    />
  )
}

// KullaniciGruplariRota: kullanıcı grupları yönetim ekranı (prop almaz).
export function KullaniciGruplariRota() {
  return <KullaniciGruplariSayfasi />
}

// KullaniciSecenekAyarlariRota: kullanıcı ekleme formunun dropdown seçeneklerini
// yöneten ayarlar ekranı (kullanıcı seçenek kategorileriyle).
export function KullaniciSecenekAyarlariRota() {
  return (
    <AyarlarSayfasi
      baslik="Kullanıcı Seçenek Tanımları"
      aciklama="Kullanıcı ekleme formundaki dropdown seçeneklerini burada yönetin. Bir kategori seçip yeni bir değer ekleyebilirsiniz."
      kategoriler={SECENEK_KATEGORILERI}
    />
  )
}

// SoruSecenekAyarlariRota: soru ekleme formunun Konu/Amaç seçeneklerini yöneten
// ayarlar ekranı (soru seçenek kategorileriyle).
export function SoruSecenekAyarlariRota() {
  return (
    <AyarlarSayfasi
      baslik="Soru Seçenek Tanımları"
      aciklama="Anket sorusu ekleme formundaki Konu ve Amaç dropdown seçeneklerini burada yönetin. Bir kategori seçip yeni bir değer ekleyebilirsiniz."
      kategoriler={SORU_SECENEK_KATEGORILERI}
    />
  )
}

// GrupTanimlariRota: grup tanımlarını yöneten ayarlar ekranı (prop almaz).
export function GrupTanimlariRota() {
  return <GrupTanimlariAyar />
}
