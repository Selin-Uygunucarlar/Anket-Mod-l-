// Kullanıcı ekleme/düzenleme ekranının mantık kapsayıcısı. Admin panelinden
// "Kullanıcı Ekle" seçilince (ekleme modu) veya kullanıcı listesindeki işlem
// menüsünden "Düzenle" seçilince (düzenleme modu) anasayfa içerik alanında
// render edilir. Yalnızca sunum sorumluluğundadır: girdi toplar, dropdown
// seçeneklerini secenekApi'den ister, düzenleme modunda mevcut kaydı
// getKullaniciDetay ile doldurur ve kaydı createKullanici/guncelleKullanici
// üzerinden backend'e iletir; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki ve
// asıl doğrulama sunucuda). Zorunlu alanların boş olup olmadığı yalnızca UX için
// (Kaydet/Güncelle butonunu pasifleştirmek) kontrol edilir. Ekleme başarısında
// üretilen geçici şifre bir kez gösterilir; düzenlemede şifre üretilmez, başarıda
// listeye dönülür ve liste tazelenir. Hata durumunda yalnızca backend'in güvenli
// mesajı gösterilir (teknik detay sızmaz). Ortak form gövdesi KullaniciFormGovde,
// paylaşılan alan tanımları common/kullaniciFormAlanlari'ndan gelir (DRY).

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSecenekler } from '../api/secenekApi.js'
import {
  createKullanici,
  guncelleKullanici,
  getKullaniciDetay,
} from '../api/kullaniciApi.js'
import { gruplaSeceneklerKategoriyeGore } from '../common/secenekKategorileri.js'
import {
  BOS_FORM,
  UYARI_SURESI_MS,
  temizleAlanDegeri,
  zorunluAlanlarDolu,
} from '../common/kullaniciFormAlanlari.js'
import GeciciSifreKutusu from './GeciciSifreKutusu.jsx'
import KullaniciFormGovde from './KullaniciFormGovde.jsx'
import '../styles/kullanici-ekle.css'

// detaydanFormHazirla: backend detay nesnesini form alan değerlerine eşler.
// null/undefined alanlar boş string'e çevrilir; tarih alanı date input'un
// beklediği YYYY-MM-DD biçimine kırpılır. Saf gösterim dönüşümüdür.
function detaydanFormHazirla(detay) {
  const form = { ...BOS_FORM }
  for (const kimlik of Object.keys(BOS_FORM)) {
    form[kimlik] = detay[kimlik] ?? ''
  }
  // ise_giris_tarihi ISO tarih/zaman gelebilir; date input icin ilk 10 karakter.
  form.ise_giris_tarihi = detay.ise_giris_tarihi
    ? String(detay.ise_giris_tarihi).slice(0, 10)
    : ''
  return form
}

// KullaniciEkleForm: ekleme veya düzenleme formunu yönetir (girdi toplama +
// gönderim). props: onGeriDon() -> "Geri Dön" ve başarı sonrası listeye dönüş;
// duzenlenecekKullanici -> verilirse düzenleme modu ({ kullanici_kodu, ... });
// verilmezse ekleme modu (davranış aynen korunur).
function KullaniciEkleForm({ onGeriDon, duzenlenecekKullanici }) {
  const duzenlemeModu = Boolean(duzenlenecekKullanici)
  // Düzenlemede path için kullanılacak ORİJİNAL sicil; form.kullanici_kodu ise
  // kullanıcının girdiği (belki değişmiş) istenen yeni sicildir.
  const mevcutSicil = duzenlenecekKullanici?.kullanici_kodu

  const [form, setForm] = useState(BOS_FORM)
  // Alan kimliği -> o an gösterilen anlık uyarı mesajı. Yalnızca uyarısı olan
  // alanlar bu haritada bulunur; her alan bağımsızdır.
  const [alanUyarilari, setAlanUyarilari] = useState({})
  // Alan başına aktif zamanlayıcı kimliğini tutar (state değil; render tetiklemez).
  // Unmount'ta ve yenilemede temizlenir, böylece unmount sonrası setState olmaz.
  const zamanlayicilarRef = useRef({})
  const queryClient = useQueryClient()

  // Bileşen unmount olurken bekleyen tüm uyarı zamanlayıcılarını temizler
  // (memory leak / unmount sonrası setState uyarısını önler).
  useEffect(() => {
    const zamanlayicilar = zamanlayicilarRef.current
    return () => {
      Object.values(zamanlayicilar).forEach(clearTimeout)
    }
  }, [])

  // Dropdown seçeneklerini çeker; kategoriye göre gruplanır. Liste boş/yüklenmiyor
  // olabilir — bu durumda dropdown'lar yalnızca placeholder gösterir (normaldir).
  const { data: secenekler, isError: secenekHatasi } = useQuery({
    queryKey: ['secenekler'],
    queryFn: listSecenekler,
  })
  const gruplandirilmis = gruplaSeceneklerKategoriyeGore(secenekler)

  // Düzenleme modunda kullanıcının mevcut tüm alanlarını çeker (liste özeti
  // dropdown/tür/tarih alanlarını içermez). Yalnızca düzenleme modunda aktiftir.
  const {
    data: detay,
    isPending: detayYukleniyor,
    isError: detayHatasi,
    error: detayHataObjesi,
  } = useQuery({
    queryKey: ['kullanici-detay', mevcutSicil],
    queryFn: () => getKullaniciDetay(mevcutSicil),
    enabled: duzenlemeModu,
  })

  // Detay geldiğinde formu bir kez mevcut değerlerle doldurur (düzenleme modu).
  useEffect(() => {
    if (detay) {
      setForm(detaydanFormHazirla(detay))
    }
  }, [detay])

  // Kaydet/Güncelle isteği. mutationFn moda göre dallanır: düzenlemede path'e
  // orijinal sicil, gövdeye güncel form gider; eklemede create çağrılır. Başarıda
  // liste (ve düzenlemede ilgili detaylar) tazelenir; teknik detay sızmaz.
  const kaydetMutation = useMutation({
    mutationFn: (guncelForm) =>
      duzenlemeModu
        ? guncelleKullanici(mevcutSicil, guncelForm)
        : createKullanici(guncelForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kullanicilar'] })
      if (duzenlemeModu) {
        // Eski ve (sicil değiştiyse) yeni koda ait tüm detay sorgularını tazele.
        queryClient.invalidateQueries({ queryKey: ['kullanici-detay'] })
        onGeriDon()
      }
    },
  })

  // alanGuncelle: tek bir form alanının değerini günceller.
  function alanGuncelle(kimlik, deger) {
    setForm((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // uyariTetikle: bir alanda geçersiz karakter ayıklandığında o alana özel kısa
  // uyarıyı gösterir. Art arda geçersiz girişte önceki zamanlayıcıyı yeniler
  // (uyarı görünür kalır) ve son girişten UYARI_SURESI_MS sonra uyarıyı kaldırır.
  function uyariTetikle(kimlik, mesaj) {
    setAlanUyarilari((oncekiler) => ({ ...oncekiler, [kimlik]: mesaj }))
    const zamanlayicilar = zamanlayicilarRef.current
    if (zamanlayicilar[kimlik]) {
      clearTimeout(zamanlayicilar[kimlik])
    }
    zamanlayicilar[kimlik] = setTimeout(() => {
      setAlanUyarilari((oncekiler) => {
        const guncel = { ...oncekiler }
        delete guncel[kimlik]
        return guncel
      })
      delete zamanlayicilar[kimlik]
    }, UYARI_SURESI_MS)
  }

  // suzVeGuncelle: alanın ham girdisini temizleAlanDegeri ile süzer ve alanı
  // günceller; süzme sırasında en az bir karakter ayıklandıysa (temiz < ham)
  // alana uygun anlık uyarıyı tetikler. Süzme + uyarı için tek giriş noktasıdır.
  function suzVeGuncelle(kimlik, temizle, hamDeger, uyariMesaji) {
    const temiz = temizleAlanDegeri(temizle, hamDeger)
    alanGuncelle(kimlik, temiz)
    if (temiz.length < hamDeger.length) {
      uyariTetikle(kimlik, uyariMesaji)
    }
  }

  // handleSubmit: formu gönderir. Zorunlu alanlar dolmadan buton pasif olduğundan
  // burada ek doğrulama yapılmaz; kayıt isteği moda göre API'ye iletilir.
  function handleSubmit(olay) {
    olay.preventDefault()
    if (!zorunluAlanlarDolu(form)) {
      return
    }
    kaydetMutation.mutate(form)
  }

  // Ekleme başarısı: geçici şifre kutusunu göster (form yerine). Şifre bir kez
  // gösterilir. Düzenlemede bu dal çalışmaz; başarıda onSuccess içinde listeye
  // dönülür (şifre üretilmez).
  if (!duzenlemeModu && kaydetMutation.isSuccess) {
    return (
      <section className="kullanici-ekle">
        <GeciciSifreKutusu
          kullaniciKodu={kaydetMutation.data.kullanici_kodu}
          geciciSifre={kaydetMutation.data.gecici_sifre}
          onGeriDon={onGeriDon}
        />
      </section>
    )
  }

  // Düzenleme modunda detay yüklenirken / hatada uygun durum gösterilir.
  if (duzenlemeModu && detayYukleniyor) {
    return (
      <section className="kullanici-ekle">
        <p className="kullanici-liste-durum">Yükleniyor...</p>
      </section>
    )
  }
  if (duzenlemeModu && detayHatasi) {
    // detayHataObjesi.message backend'in güvenli mesajıdır; teknik detay sızmaz.
    return (
      <section className="kullanici-ekle">
        <div className="kullanici-ekle-hata" role="alert">
          {detayHataObjesi?.message ||
            'Kullanıcı detayı yüklenemedi. Lütfen tekrar deneyin.'}
        </div>
        <div className="kullanici-ekle-butonlar">
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </section>
    )
  }

  const kaydetPasif = !zorunluAlanlarDolu(form) || kaydetMutation.isPending
  const baslik = duzenlemeModu ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'
  const butonMetni = duzenlemeModu
    ? kaydetMutation.isPending
      ? 'Güncelleniyor...'
      : 'Güncelle'
    : kaydetMutation.isPending
    ? 'Kaydediliyor...'
    : 'Kaydet'
  const hataMesaji = kaydetMutation.isError
    ? kaydetMutation.error?.message ||
      (duzenlemeModu
        ? 'Kullanıcı güncellenemedi. Lütfen tekrar deneyin.'
        : 'Kullanıcı eklenemedi. Lütfen tekrar deneyin.')
    : ''

  return (
    <KullaniciFormGovde
      baslik={baslik}
      form={form}
      alanUyarilari={alanUyarilari}
      suzVeGuncelle={suzVeGuncelle}
      alanGuncelle={alanGuncelle}
      gruplandirilmis={gruplandirilmis}
      secenekHatasi={secenekHatasi}
      hataMesaji={hataMesaji}
      kaydetPasif={kaydetPasif}
      butonMetni={butonMetni}
      onSubmit={handleSubmit}
      onGeriDon={onGeriDon}
    />
  )
}

export default KullaniciEkleForm
