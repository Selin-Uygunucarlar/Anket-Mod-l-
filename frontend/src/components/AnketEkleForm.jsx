// Anket oluşturma/güncelleme ekranının kapsayıcısı. Anket listesindeki "Anket Ekle"
// butonuyla (oluşturma modu) veya bir satırın "Güncelle" butonuyla (düzenleme modu)
// anasayfa içerik alanında render edilir. Yalnızca sunum sorumluluğundadır: form
// state'ini tutar, kartları (bölümleri) dizer ve kaydı oluşturmada anketApi.ekleAnket,
// düzenlemede anketApi.guncelleAnket üzerinden backend'e iletir; iş kuralı, yetki
// veya hesaplama İÇERMEZ (yetki ve asıl doğrulama sunucuda). Düzenleme modunda mevcut
// anket anketApi.anketDetayGetir ile çekilip anketDetayindanForm ile ön-doldurulur;
// atamalarda FARK (kim eklenecek/çıkarılacak) SUNUCUDA hesaplanır (UI yalnızca istenen
// nihai listeleri taşır). Gruplar geri gelmez: düzenlemede grup listesi boş açılır. Zorunlu alanların (Adı, Anket Tipi, Sorular, Başlangıç
// ve Bitiş Tarihi) boşluğu yalnızca UX için (Kaydet'i pasifleştirmek) kontrol edilir;
// sunucu doğrulaması bunlara güvenilerek atlanmaz. Tarihler için UI'da TARİH
// HESAPLANMAZ: yalnızca seçim kimliği sunucuya taşınır, tarihi anket servisi hesaplar.
// Erişim seviyesi "grup" seçilse de grup sorulmaz/gönderilmez: sunucu oturum
// sahibinin kendi grubunu kullanır.
// Sorular, ankete atanacak kullanıcılar ve gruplar YENİ SEKMEDE açılan seçme
// ekranlarından postMessage ile gelir; mesajın origin'i doğrulanır.
// Her bölüm kendi kart bileşenindedir (SRP): AnketBilgileriKarti,
// AnketSorulariKarti, AnketTarihleriKarti, AnketKullanicilariKarti,
// AnketMesajAyarlariKarti, AnketIslemleriKarti. Kullanıcılar kartının atama
// seçimleri (seçilen kullanıcılar/gruplar) SUNUCUYA GÖNDERİLİR, ancak yalnızca
// ilgili kutu işaretliyken: ekranda görünmeyen seçim gönderilmez. Mesaj Ayarları
// ve İşlemler kartları HÂLÂ bu fazın DIŞINDADIR: ekranda dururlar ama sunucuya
// gönderilmez (bkz. o bileşenlerin dosya başı yorumları). Görünüm sınıfları
// kullanici-ekle.css ile paylaşılır (DRY); anket-ekle.css yalnızca gereken ek
// stilleri getirir.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ekleAnket, anketDetayGetir, guncelleAnket } from '../api/anketApi.js'
import AnketBilgileriKarti from './AnketBilgileriKarti.jsx'
import AnketSorulariKarti from './AnketSorulariKarti.jsx'
import AnketTarihleriKarti from './AnketTarihleriKarti.jsx'
import AnketKullanicilariKarti from './AnketKullanicilariKarti.jsx'
import AnketMesajAyarlariKarti from './AnketMesajAyarlariKarti.jsx'
import AnketIslemleriKarti from './AnketIslemleriKarti.jsx'
import {
  BOS_ANKET_FORMU,
  SABIT_LISTE_ATAMASI,
  KULLANICI_GRUPLARI_ATAMASI,
  secimleriBirlestir,
  tarihAlaniGecersiz,
  anketDetayindanForm,
} from '../common/anketFormAlanlari.js'
import {
  SORU_SECIM_MESAJ_TIPI,
  KULLANICI_SECIM_MESAJ_TIPI,
  GRUP_SECIM_MESAJ_TIPI,
} from '../common/secimSekmesi.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// Yeni sekmede açılan seçme ekranlarının rota adresleri; App.jsx'teki rotalarla
// birebir aynı olmalıdır.
const SORU_SEC_YOLU = '/anket-sorulari-sec'
const KULLANICI_SEC_YOLU = '/anket-kullanicilari-sec'
const GRUP_SEC_YOLU = '/anket-gruplari-sec'

// atamaSecenegiIsaretle: verilen atama seçeneğini işaretli hale getirir; zaten
// işaretliyse liste olduğu gibi döner (aynı seçenek iki kez eklenmez). Seçme
// ekranından liste dönünce ilgili kutu boş kalmasın diye kullanılır.
function atamaSecenegiIsaretle(seciliAtamalar, deger) {
  return seciliAtamalar.includes(deger)
    ? seciliAtamalar
    : [...seciliAtamalar, deger]
}

// formuIstekGovdesineCevir: form state'ini backend'in beklediği gövde şekline
// eşler (salt biçim dönüşümü; iş kuralı değil). Seçilmemiş dropdown'lar formda ''
// tutulur, sunucu ise "gönderilmedi" için null bekler -> boş değerler null'a
// çevrilir. Tarihler HESAPLANMAZ: yalnızca seçim kimliği ve (varsa) takvim değeri
// taşınır; hesabı sunucu yapar. Atama listeleri sunucuya düz kimlik listesi olarak
// gider ve YALNIZCA ilgili kutu işaretliyse doldurulur: kutu boşken liste ekranda
// gizli olduğundan gönderilmez ([] gider) — ekranda görünmeyen seçim sunucuya
// gitmez. Mesaj Ayarları ve İşlemler kartlarının seçimleri bu fazın dışında olduğu
// için bilinçli olarak gövdeye KONMAZ.
function formuIstekGovdesineCevir(form) {
  const sabitListeIsaretli = form.kullanici_atama.includes(SABIT_LISTE_ATAMASI)
  const kullaniciGruplariIsaretli = form.kullanici_atama.includes(
    KULLANICI_GRUPLARI_ATAMASI,
  )

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
    kullanici_kodlari: sabitListeIsaretli
      ? form.secili_kullanicilar.map((kullanici) => kullanici.kullanici_kodu)
      : [],
    grup_idler: kullaniciGruplariIsaretli
      ? form.secili_gruplar.map((grup) => grup.grup_id)
      : [],
  }
}

// AnketEkleForm: anket oluşturma/güncelleme formunu yönetir (girdi toplama + gönderim).
// props: onGeriDon() -> "Geri Dön" tıklanınca ve kayıt başarısında çağrılır (üst
// bileşen listeye döner); duzenlenecekAnketId -> verilirse düzenleme modu (anketin
// anket_id'si); verilmezse oluşturma modu (davranış aynen korunur).
function AnketEkleForm({ onGeriDon, duzenlenecekAnketId }) {
  const duzenlemeModu = Boolean(duzenlenecekAnketId)
  const [form, setForm] = useState(BOS_ANKET_FORMU)
  // Kaydet'e en az bir kez basıldı mı? Mesaj Ayarları kartındaki boş "gün önce"
  // uyarısı yalnızca basıldıktan sonra görünsün diye tutulur (anında değil).
  const [kaydetDenendi, setKaydetDenendi] = useState(false)
  const queryClient = useQueryClient()

  // Düzenleme modunda mevcut anketin tüm alanlarını backend'den çeker (yalnızca
  // düzenleme modunda aktiftir). SoruEkleForm düzenleme kalıbıyla aynıdır.
  const {
    data: anketDetayi,
    isPending: detayYukleniyor,
    isError: detayHatasi,
    error: detayHataObjesi,
  } = useQuery({
    queryKey: ['anket-detay', duzenlenecekAnketId],
    queryFn: () => anketDetayGetir(duzenlenecekAnketId),
    enabled: duzenlemeModu,
  })

  // Detay geldiğinde formu bir kez mevcut değerlerle doldurur (düzenleme modu).
  // anketDetayindanForm salt biçim dönüşümüdür; tarihler 'tarih_sec' + gerçek
  // takvim değeriyle, atanan kişiler "Sabit liste"yle önceden doldurulur.
  useEffect(() => {
    if (!anketDetayi) {
      return
    }
    setForm(anketDetayindanForm(anketDetayi))
  }, [anketDetayi])

  // Kaydet isteği: başarıda anket listesini (ve düzenlemede detay sorgularını)
  // tazeler ve listeye döner. mutationFn moda göre dallanır — düzenlemede
  // guncelleAnket(anket_id, govde), oluşturmada ekleAnket(govde). Hata gösteriminde
  // yalnızca backend'in güvenli mesajı kullanılır (teknik detay sızmaz).
  const kaydetMutation = useMutation({
    mutationFn: (guncelForm) => {
      const govde = formuIstekGovdesineCevir(guncelForm)
      return duzenlemeModu
        ? guncelleAnket(duzenlenecekAnketId, govde)
        : ekleAnket(govde)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anketler'] })
      if (duzenlemeModu) {
        queryClient.invalidateQueries({ queryKey: ['anket-detay'] })
      }
      onGeriDon()
    },
  })

  // Yeni sekmedeki seçme ekranlarından (soru / kullanıcı / grup) gelen seçim
  // mesajlarını dinler ve gelenleri forma yazar. GÜVENLİK: mesaj yalnızca KENDİ
  // origin'imizden geliyorsa kabul edilir; aksi halde herhangi bir site forma
  // kayıt enjekte edebilirdi. Dinleyici unmount'ta kaldırılır.
  useEffect(() => {
    function secimMesajiniAl(olay) {
      if (olay.origin !== window.location.origin) {
        return
      }
      const mesaj = olay.data

      if (mesaj?.tip === SORU_SECIM_MESAJ_TIPI) {
        const gelenSorular = Array.isArray(mesaj.sorular) ? mesaj.sorular : []
        setForm((oncekiler) => ({
          ...oncekiler,
          secili_sorular: secimleriBirlestir(
            oncekiler.secili_sorular,
            gelenSorular,
            (soru) => soru.soru_id,
          ),
        }))
        return
      }

      // Kullanıcı/grup seçimi geldiğinde ilgili checkbox da işaretlenir: kullanıcı
      // seçim yapmışken kutunun boş kalması yanıltıcı olurdu (salt UX).
      if (mesaj?.tip === KULLANICI_SECIM_MESAJ_TIPI) {
        const gelenKullanicilar = Array.isArray(mesaj.kullanicilar)
          ? mesaj.kullanicilar
          : []
        setForm((oncekiler) => ({
          ...oncekiler,
          secili_kullanicilar: secimleriBirlestir(
            oncekiler.secili_kullanicilar,
            gelenKullanicilar,
            (kullanici) => kullanici.kullanici_kodu,
          ),
          kullanici_atama: atamaSecenegiIsaretle(
            oncekiler.kullanici_atama,
            SABIT_LISTE_ATAMASI,
          ),
        }))
        return
      }

      if (mesaj?.tip === GRUP_SECIM_MESAJ_TIPI) {
        const gelenGruplar = Array.isArray(mesaj.gruplar) ? mesaj.gruplar : []
        setForm((oncekiler) => ({
          ...oncekiler,
          secili_gruplar: secimleriBirlestir(
            oncekiler.secili_gruplar,
            gelenGruplar,
            (grup) => grup.grup_id,
          ),
          kullanici_atama: atamaSecenegiIsaretle(
            oncekiler.kullanici_atama,
            KULLANICI_GRUPLARI_ATAMASI,
          ),
        }))
      }
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

  // kullaniciSecmeyiAc: kullanıcı seçme ekranını yeni sekmede açar (soru seçmeyle
  // aynı gerekçe: 'noopener' kullanılmaz, dönen mesajın origin'i doğrulanır).
  function kullaniciSecmeyiAc() {
    window.open(KULLANICI_SEC_YOLU, '_blank')
  }

  // grupSecmeyiAc: grup seçme ekranını yeni sekmede açar (aynı kalıp).
  function grupSecmeyiAc() {
    window.open(GRUP_SEC_YOLU, '_blank')
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

  // kullaniciKaldir: sabit listeye eklenmiş bir kullanıcıyı listeden çıkarır.
  function kullaniciKaldir(kullaniciKodu) {
    setForm((oncekiler) => ({
      ...oncekiler,
      secili_kullanicilar: oncekiler.secili_kullanicilar.filter(
        (kullanici) => kullanici.kullanici_kodu !== kullaniciKodu,
      ),
    }))
  }

  // grupKaldir: eklenmiş bir kullanıcı grubunu listeden çıkarır.
  function grupKaldir(grupId) {
    setForm((oncekiler) => ({
      ...oncekiler,
      secili_gruplar: oncekiler.secili_gruplar.filter(
        (grup) => grup.grup_id !== grupId,
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

  // Düzenleme modunda mevcut anket çekilirken / çekilemezse uygun durum gösterilir
  // (SoruEkleForm düzenleme kalıbıyla aynı). Oluşturma modunda bu guard'lar atlanır.
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
            'Anket bilgileri yüklenemedi. Lütfen tekrar deneyin.'}
        </div>
        <div className="kullanici-ekle-butonlar">
          <button type="button" className="ikincil-buton" onClick={onGeriDon}>
            Geri Dön
          </button>
        </div>
      </section>
    )
  }

  // Kayıt başarısızsa gösterilecek mesaj: yalnızca backend'in güvenli mesajı
  // (yoksa moda uygun jenerik). Teknik detay/stack ekrana yansıtılmaz.
  const kayitHataMesaji = kaydetMutation.isError
    ? kaydetMutation.error?.message ||
      (duzenlemeModu
        ? 'Anket güncellenemedi. Lütfen tekrar deneyin.'
        : 'Anket kaydedilemedi. Lütfen tekrar deneyin.')
    : ''

  // Kaydet butonunun metni moda ve istek durumuna göre belirlenir (salt gösterim).
  const kaydetButonMetni = duzenlemeModu
    ? kaydetMutation.isPending
      ? 'Güncelleniyor...'
      : 'Güncelle'
    : kaydetMutation.isPending
      ? 'Kaydediliyor...'
      : 'Kaydet'

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

        {/* Kullanıcılar kartı: atama seçenekleri ile "Listeden seç" ekranlarından
            gelen kullanıcı/grup listeleri. Bir liste yalnızca kutusu işaretliyken
            görünür ve yalnızca o zaman sunucuya gider; işaret kalkınca seçim
            formda korunur ama gönderilmez. */}
        <AnketKullanicilariKarti
          seciliAtamalar={form.kullanici_atama}
          onSecimDegistir={(deger) =>
            cokluSeciminiDegistir('kullanici_atama', deger)
          }
          secilenKullanicilar={form.secili_kullanicilar}
          secilenGruplar={form.secili_gruplar}
          onKullaniciSecmeyiAc={kullaniciSecmeyiAc}
          onGrupSecmeyiAc={grupSecmeyiAc}
          onKullaniciKaldir={kullaniciKaldir}
          onGrupKaldir={grupKaldir}
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
              {kaydetButonMetni}
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
