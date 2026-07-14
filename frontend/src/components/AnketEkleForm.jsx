// Anket oluşturma/güncelleme ekranının kapsayıcısı. Anket listesindeki "Anket Ekle"
// butonuyla anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır:
// form state'ini tutar, kartları (bölümleri) dizer ve kaydı anketApi.ekleAnket
// üzerinden backend'e iletir; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki ve
// asıl doğrulama sunucuda). Zorunlu alanların (Adı, Anket Tipi, Sorular, Başlangıç
// ve Bitiş Tarihi) boşluğu yalnızca UX için (Kaydet'i pasifleştirmek) kontrol edilir;
// sunucu doğrulaması bunlara güvenilerek atlanmaz. Tarihler için UI'da TARİH
// HESAPLANMAZ: yalnızca seçim kimliği sunucuya taşınır, tarihi anket servisi hesaplar.
// Erişim seviyesi "grup" seçilse de grup sorulmaz/gönderilmez: sunucu oturum
// sahibinin kendi grubunu kullanır.
// Sorular YENİ SEKMEDE açılan soru seçme ekranından postMessage ile gelir; mesajın
// origin'i doğrulanır. Her bölüm kendi kart bileşenindedir (SRP): AnketBilgileriKarti,
// AnketSorulariKarti, AnketTarihleriKarti, AnketKullanicilariKarti,
// AnketMesajAyarlariKarti, AnketIslemleriKarti. Kullanıcılar / Mesaj Ayarları /
// İşlemler kartları bu fazın DIŞINDADIR: ekranda dururlar ama SUNUCUYA GÖNDERİLMEZ
// (bkz. o bileşenlerin dosya başı yorumları). Görünüm sınıfları kullanici-ekle.css
// ile paylaşılır (DRY); anket-ekle.css yalnızca gereken ek stilleri getirir.

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ekleAnket } from '../api/anketApi.js'
import AnketBilgileriKarti from './AnketBilgileriKarti.jsx'
import AnketSorulariKarti from './AnketSorulariKarti.jsx'
import AnketTarihleriKarti from './AnketTarihleriKarti.jsx'
import AnketKullanicilariKarti from './AnketKullanicilariKarti.jsx'
import AnketMesajAyarlariKarti from './AnketMesajAyarlariKarti.jsx'
import AnketIslemleriKarti from './AnketIslemleriKarti.jsx'
import {
  BOS_ANKET_FORMU,
  tarihAlaniGecersiz,
} from '../common/anketFormAlanlari.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// Soru seçme ekranının rota adresi (yeni sekmede açılır) ve o ekranın geri
// gönderdiği mesajın tipi. İkisi de SoruSecPage ile birebir aynı olmalıdır.
const SORU_SEC_YOLU = '/anket-sorulari-sec'
const SECIM_MESAJ_TIPI = 'anket-sorulari-secildi'

// sorulariBirlestir: soru seçme ekranından gelen soruları mevcut listenin sonuna
// ekler; formda zaten bulunan sorular tekrar EKLENMEZ (aynı soru listede iki kez
// görünmesin). Gelen sıra korunur. Salt liste birleştirmesidir; iş kuralı değildir.
function sorulariBirlestir(mevcutSorular, gelenSorular) {
  const mevcutKimlikler = new Set(mevcutSorular.map((soru) => soru.soru_id))
  const yeniler = gelenSorular.filter(
    (soru) => !mevcutKimlikler.has(soru.soru_id),
  )
  return [...mevcutSorular, ...yeniler]
}

// formuIstekGovdesineCevir: form state'ini backend'in beklediği gövde şekline
// eşler (salt biçim dönüşümü; iş kuralı değil). Seçilmemiş dropdown'lar formda ''
// tutulur, sunucu ise "gönderilmedi" için null bekler -> boş değerler null'a
// çevrilir. Tarihler HESAPLANMAZ: yalnızca seçim kimliği ve (varsa) takvim değeri
// taşınır; hesabı sunucu yapar. Bu fazın kapsamı dışındaki kartların (Kullanıcılar,
// Mesaj Ayarları, İşlemler) seçimleri bilinçli olarak gövdeye KONMAZ.
function formuIstekGovdesineCevir(form) {
  return {
    ad: form.adi,
    on_yazi: form.on_yazi,
    son_yazi: form.son_yazi,
    aciklama: form.aciklama,
    durum: form.durum,
    anket_tipi: form.anket_tipi,
    erisim_seviyesi: form.erisim_seviyesi || null,
    baslangic_secim: form.baslangic_secim,
    baslangic_tarih: form.baslangic_tarih || null,
    bitis_secim: form.bitis_secim,
    bitis_tarih: form.bitis_tarih || null,
    soru_idler: form.secili_sorular.map((soru) => soru.soru_id),
  }
}

// AnketEkleForm: anket oluşturma formunu yönetir (girdi toplama + gönderim).
// props: onGeriDon() -> "Geri Dön" tıklanınca ve kayıt başarısında çağrılır (üst
// bileşen listeye döner).
function AnketEkleForm({ onGeriDon }) {
  const [form, setForm] = useState(BOS_ANKET_FORMU)
  // Kaydet'e en az bir kez basıldı mı? Mesaj Ayarları kartındaki boş "gün önce"
  // uyarısı yalnızca basıldıktan sonra görünsün diye tutulur (anında değil).
  const [kaydetDenendi, setKaydetDenendi] = useState(false)
  const queryClient = useQueryClient()

  // Kaydet isteği: başarıda anket listesini tazeler ve listeye döner. Hata
  // gösteriminde yalnızca backend'in güvenli mesajı kullanılır (teknik detay sızmaz).
  const kaydetMutation = useMutation({
    mutationFn: (guncelForm) => ekleAnket(formuIstekGovdesineCevir(guncelForm)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anketler'] })
      onGeriDon()
    },
  })

  // Yeni sekmedeki soru seçme ekranından gelen seçim mesajını dinler ve seçilen
  // soruları forma yazar. GÜVENLİK: mesaj yalnızca KENDİ origin'imizden geliyorsa
  // kabul edilir; aksi halde herhangi bir site forma soru enjekte edebilirdi.
  // Dinleyici unmount'ta kaldırılır.
  useEffect(() => {
    function secimMesajiniAl(olay) {
      if (olay.origin !== window.location.origin) {
        return
      }
      if (olay.data?.tip !== SECIM_MESAJ_TIPI) {
        return
      }
      const gelenSorular = Array.isArray(olay.data.sorular)
        ? olay.data.sorular
        : []
      setForm((oncekiler) => ({
        ...oncekiler,
        secili_sorular: sorulariBirlestir(oncekiler.secili_sorular, gelenSorular),
      }))
    }
    window.addEventListener('message', secimMesajiniAl)
    return () => window.removeEventListener('message', secimMesajiniAl)
  }, [])

  // alanGuncelle: tek bir form alanının değerini günceller (kontrollü girdiler).
  function alanGuncelle(kimlik, deger) {
    setForm((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // cokluSeciminiDegistir: bir checkbox grubunun (dizi tutan alanKimligi) işaretini
  // değiştirir; deger dizide varsa çıkarır, yoksa ekler (seçenekler bağımsız).
  // Kullanıcılar (kullanici_atama) ve İşlemler (islem_secenekleri) kartları kullanır.
  function cokluSeciminiDegistir(alanKimligi, deger) {
    setForm((oncekiler) => {
      const secili = oncekiler[alanKimligi].includes(deger)
        ? oncekiler[alanKimligi].filter((oge) => oge !== deger)
        : [...oncekiler[alanKimligi], deger]
      return { ...oncekiler, [alanKimligi]: secili }
    })
  }

  // soruSecmeyiAc: soru seçme ekranını yeni sekmede açar. 'noopener' KULLANILMAZ:
  // seçim, açılan sekmeden window.opener üzerinden geri gönderilir. Hedef kendi
  // origin'imizdir ve dönen mesajın origin'i dinleyicide ayrıca doğrulanır.
  function soruSecmeyiAc() {
    window.open(SORU_SEC_YOLU, '_blank')
  }

  // soruKaldir: ankete eklenmiş bir soruyu listeden çıkarır.
  function soruKaldir(soruId) {
    setForm((oncekiler) => ({
      ...oncekiler,
      secili_sorular: oncekiler.secili_sorular.filter(
        (soru) => soru.soru_id !== soruId,
      ),
    }))
  }

  // anketiKaydet: formu gönderir. Kaydet butonu zorunlu alanlar dolmadan pasif
  // olduğundan burada ek kontrol yapılmaz; kayıt isteği API'ye iletilir.
  function anketiKaydet(olay) {
    olay.preventDefault()
    setKaydetDenendi(true)
    kaydetMutation.mutate(form)
  }

  // Kaydet yalnızca zorunlu alanlar (Adı, Anket Tipi, Sorular, Başlangıç ve Bitiş
  // Tarihi) dolunca aktif olur; istek sürerken de pasiftir (çift gönderimi önler).
  // Bu sadece UX içindir, güvenlik/doğrulama sınırı değildir: asıl doğrulama
  // sunucuda yapılır ve sunucu yanıtı her durumda dikkate alınır.
  const kaydetPasif =
    form.adi.trim() === '' ||
    form.anket_tipi === '' ||
    form.secili_sorular.length === 0 ||
    tarihAlaniGecersiz(form.baslangic_secim, form.baslangic_tarih) ||
    tarihAlaniGecersiz(form.bitis_secim, form.bitis_tarih) ||
    kaydetMutation.isPending

  // Kayıt başarısızsa gösterilecek mesaj: yalnızca backend'in güvenli mesajı
  // (yoksa jenerik). Teknik detay/stack ekrana yansıtılmaz.
  const kayitHataMesaji = kaydetMutation.isError
    ? kaydetMutation.error?.message ||
      'Anket kaydedilemedi. Lütfen tekrar deneyin.'
    : ''

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">Anket Oluşturma - Güncelleme</h2>

      {/* Form gönderimi Kaydet butonuyla tetiklenir; tarayıcının kendi doğrulaması
          (noValidate) kapalıdır — alan kontrolleri UX içindir, asıl doğrulama
          sunucudadır. */}
      <form className="kullanici-ekle-form" noValidate onSubmit={anketiKaydet}>
        <AnketBilgileriKarti form={form} alanGuncelle={alanGuncelle} />

        {/* Sorular kartı (zorunlu): ankete eklenen soruları gösterir. "Yüklemek
            için tıklayınız" soru seçme ekranını yeni sekmede açar; seçim geri
            geldiğinde forma yazılır. */}
        <AnketSorulariKarti
          secilenSorular={form.secili_sorular}
          onSoruSecmeyiAc={soruSecmeyiAc}
          onSoruKaldir={soruKaldir}
        />

        <AnketTarihleriKarti form={form} alanGuncelle={alanGuncelle} />

        <AnketKullanicilariKarti
          seciliAtamalar={form.kullanici_atama}
          onSecimDegistir={(deger) =>
            cokluSeciminiDegistir('kullanici_atama', deger)
          }
        />

        <AnketMesajAyarlariKarti
          form={form}
          alanGuncelle={alanGuncelle}
          kaydetDenendi={kaydetDenendi}
        />

        <AnketIslemleriKarti
          seciliIslemler={form.islem_secenekleri}
          onIslemDegistir={(deger) =>
            cokluSeciminiDegistir('islem_secenekleri', deger)
          }
          soruGosterim={form.soru_gosterim}
          onSoruGosterimDegis={(deger) => alanGuncelle('soru_gosterim', deger)}
        />

        {/* Kayıt hatası: yalnızca backend'in güvenli mesajı gösterilir. */}
        {kayitHataMesaji && (
          <div className="kullanici-ekle-hata" role="alert">
            {kayitHataMesaji}
          </div>
        )}

        <div className="kullanici-ekle-butonlar">
          {/* Kaydet: anketi backend'e kaydeder; başarıda liste tazelenip listeye
              dönülür. Zorunlu alanlar dolmadıkça ve istek sürerken pasiftir
              (yalnızca UX; asıl doğrulama sunucuda). */}
          <span
            className="kaydet-sarmalayici"
            data-uyari={
              kaydetPasif ? 'Lütfen zorunlu alanları doldurun' : undefined
            }
          >
            <button
              type="submit"
              className="birincil-buton"
              disabled={kaydetPasif}
            >
              {kaydetMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </span>
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </form>
    </section>
  )
}

export default AnketEkleForm
