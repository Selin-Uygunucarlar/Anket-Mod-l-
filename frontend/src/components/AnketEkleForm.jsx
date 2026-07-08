// Anket oluşturma/güncelleme formu. Anket listesindeki "Anket Ekle" butonuyla
// anasayfa içerik alanında render edilir. ŞİMDİLİK yalnızca UI iskeletidir:
// backend/API/servis/repository yoktur; girdiler saf UI state'inde toplanır ve
// Kaydet butonu gerçek bir kayıt YAPMAZ (yanıltıcı "başarı" gösterilmez).
// Yalnızca sunum sorumluluğundadır: alanları gösterir ve girdi toplar; iş kuralı,
// yetki veya hesaplama İÇERMEZ. Zorunlu alanların (Adı, Anket Tipi, Başlangıç ve
// Bitiş Tarihi) boş olup olmadığı yalnızca UX için (Kaydet butonunu pasifleştirmek)
// kontrol edilir; asıl doğrulama ileride sunucuda yapılacaktır. Tarihler kartındaki
// "Yarın"/"Bir Ay" gibi seçimler için GERÇEK TARİH HESABI YAPILMAZ; yalnızca hangi
// seçeneğin seçildiği state'te tutulur, hesap ileride servis katmanına bırakılır.
// Tarihler kartında "Tarih seç" işaretlenince takvim girdisi, o seçeneğin YANINDA
// (aynı satırda, sağında) koşullu olarak görünür; ayrı bir alt satırda değil.
// Kullanıcılar kartında "Sabit liste"/"Kullanıcı Grupları" checkbox'ları İKİSİ DE
// işaretlenebilir; gerçek atama YAPILMAZ, yalnızca seçim state'te tutulur (tarih
// seçimleriyle aynı felsefe). Mesaj Ayarları kartında üç BAĞIMSIZ checkbox vardır:
// (1) başlangıçtan 1 gün önce mail, (2) bitişten X gün önce N günde bir site içi
// hatırlatma (işaretliyken satır içi sayı girdisi ve sıklık dropdown'ı aktifleşir),
// (3) mesajların Stil şablonu ile gönderimi. Salt gösterimdir: GERÇEK MAIL/BİLDİRİM
// GÖNDERİLMEZ, yalnızca seçimler state'te tutulur. İşlemler kartında dört BAĞIMSIZ
// işlem checkbox'ı (birden çoğu seçilebilir) ve soru gösterim biçimi için 3'lü radyo
// grubu (varsayılan seçili) vardır; salt gösterimdir, GERÇEK İŞLEV YOK, yalnızca
// seçimler state'te tutulur. Kişi formundaki gibi tek modda
// kullanıldığından ortak gövde bileşenine BÖLÜNMEZ (over-engineering yasağı).
// Görünüm sınıfları kullanici-ekle.css ile paylaşılır (DRY); radyo grupları ve
// alt başlık için gereken minimum ek stil anket-ekle.css'ten gelir.

import { Fragment, useEffect, useRef, useState } from 'react'
import AnketKart from './AnketKart'
import {
  ANKET_TIPI_SECENEKLERI,
  DURUM_SECENEKLERI,
  ERISIM_SEVIYESI_SECENEKLERI,
  BASLANGIC_TARIHI_SECENEKLERI,
  BITIS_TARIHI_SECENEKLERI,
  KULLANICI_ATAMA_SECENEKLERI,
  HATIRLATMA_SIKLIGI_SECENEKLERI,
  ISLEM_SECENEKLERI,
  SORU_GOSTERIM_SECENEKLERI,
  BOS_ANKET_FORMU,
  UYARI_SURESI_MS,
  tarihAlaniGecersiz,
} from '../common/anketFormAlanlari.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// AnketEkleForm: anket oluşturma/güncelleme alanlarını gösterir ve girdi toplar.
// props: onGeriDon() -> "Geri Dön" tıklanınca çağrılır (üst bileşen listeye döner).
function AnketEkleForm({ onGeriDon }) {
  const [form, setForm] = useState(BOS_ANKET_FORMU)
  // "gün önce" kutusuna rakam dışı karakter girildiğinde kısa süre görünüp
  // kendiliğinden kaybolan anlık uyarı mesajı (boşsa uyarı yok). Tek alan için.
  const [rakamUyarisi, setRakamUyarisi] = useState('')
  // Kaydet'e en az bir kez basıldı mı? Boş "gün önce" uyarısı yalnızca basıldıktan
  // sonra görünsün diye tutulur (anında değil, Kaydet denemesinde).
  const [kaydetDenendi, setKaydetDenendi] = useState(false)
  // Anlık rakam uyarısının zamanlayıcı kimliği (state değil; render tetiklemez).
  // Art arda girişte yenilenir, unmount'ta temizlenir.
  const rakamZamanlayiciRef = useRef(null)

  // Bileşen unmount olurken bekleyen rakam uyarısı zamanlayıcısını temizler
  // (unmount sonrası setState uyarısını / memory leak'i önler).
  useEffect(() => {
    return () => {
      if (rakamZamanlayiciRef.current) {
        clearTimeout(rakamZamanlayiciRef.current)
      }
    }
  }, [])

  // alanGuncelle: tek bir form alanının değerini günceller (kontrollü girdiler).
  function alanGuncelle(kimlik, deger) {
    setForm((oncekiler) => ({ ...oncekiler, [kimlik]: deger }))
  }

  // rakamUyariTetikle: "gün önce" kutusundan rakam dışı karakter ayıklandığında
  // anlık uyarıyı gösterir. Art arda geçersiz girişte önceki zamanlayıcıyı yeniler
  // (uyarı görünür kalır) ve son girişten UYARI_SURESI_MS sonra uyarıyı kaldırır.
  function rakamUyariTetikle(mesaj) {
    setRakamUyarisi(mesaj)
    if (rakamZamanlayiciRef.current) {
      clearTimeout(rakamZamanlayiciRef.current)
    }
    rakamZamanlayiciRef.current = setTimeout(() => {
      setRakamUyarisi('')
      rakamZamanlayiciRef.current = null
    }, UYARI_SURESI_MS)
  }

  // gunOnceGuncelle: "gün önce" ham girdisinden rakam dışı karakterleri süzer ve
  // alanı günceller; en az bir karakter ayıklandıysa anlık rakam uyarısını tetikler.
  function gunOnceGuncelle(hamDeger) {
    const temiz = hamDeger.replace(/\D/g, '')
    alanGuncelle('hatirlatma_gun_once', temiz)
    if (temiz.length < hamDeger.length) {
      rakamUyariTetikle('Lütfen yalnızca rakam girin.')
    }
  }

  // cokluSeciminiDegistir: bir checkbox grubunun (dizi tutan alanKimligi) işaretini
  // değiştirir; deger dizide varsa çıkarır, yoksa ekler (seçenekler bağımsız).
  // Yalnızca "Kullanıcılar" kartı (kullanici_atama) bu dizi tabanlı grubu kullanır.
  function cokluSeciminiDegistir(alanKimligi, deger) {
    setForm((oncekiler) => {
      const secili = oncekiler[alanKimligi].includes(deger)
        ? oncekiler[alanKimligi].filter((oge) => oge !== deger)
        : [...oncekiler[alanKimligi], deger]
      return { ...oncekiler, [alanKimligi]: secili }
    })
  }

  // Kaydet yalnızca zorunlu alanlar (Adı, Anket Tipi, Başlangıç ve Bitiş Tarihi)
  // dolunca aktif olur; bu sadece UX içindir, güvenlik/doğrulama sınırı değildir.
  const kaydetPasif =
    form.adi.trim() === '' ||
    form.anket_tipi === '' ||
    tarihAlaniGecersiz(form.baslangic_secim, form.baslangic_tarih) ||
    tarihAlaniGecersiz(form.bitis_secim, form.bitis_tarih)

  // "gün önce" kutusunun altındaki tek uyarı yuvasında gösterilecek mesaj. Önceliği
  // anlık rakam uyarısı alır; o boşsa, Kaydet'e basılmışken hatırlatma işaretli ve
  // kutu boşsa "kaç gün önce" uyarısı gösterilir. Türetilmiş (ekstra state yok),
  // yalnızca UX bilgilendirmesidir. Geçerli rakam girilince koşul kendiliğinden düşer.
  const bosKaydetUyarisiGoster =
    kaydetDenendi &&
    form.mesaj_hatirlatma &&
    form.hatirlatma_gun_once.trim() === ''
  const hatirlatmaGunUyariMesaji =
    rakamUyarisi ||
    (bosKaydetUyarisiGoster ? 'Lütfen kaç gün önce olduğunu girin.' : '')

  return (
    <section className="kullanici-ekle">
      <h2 className="kullanici-ekle-baslik">Anket Oluşturma - Güncelleme</h2>

      {/* Backend olmadığından form gönderimi yoktur; alanlar saf UI state'inde
          toplanır. Kaydet butonu type="button" ve işlevsizdir. */}
      <form className="kullanici-ekle-form" noValidate>
        <AnketKart baslik="Anket Bilgileri">
        <div className="kullanici-ekle-izgara">
          <label className="form-satir">
            <span className="form-etiket">
              Adı <span className="zorunlu-yildiz">*</span>
            </span>
            <input
              className="form-kutu"
              type="text"
              value={form.adi}
              onChange={(olay) => alanGuncelle('adi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Ön Yazı</span>
            <input
              className="form-kutu"
              type="text"
              value={form.on_yazi}
              onChange={(olay) => alanGuncelle('on_yazi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Son Yazı</span>
            <input
              className="form-kutu"
              type="text"
              value={form.son_yazi}
              onChange={(olay) => alanGuncelle('son_yazi', olay.target.value)}
            />
          </label>

          <label className="form-satir">
            <span className="form-etiket">Açıklama</span>
            <input
              className="form-kutu"
              type="text"
              value={form.aciklama}
              onChange={(olay) => alanGuncelle('aciklama', olay.target.value)}
            />
          </label>

          {/* Durum: radyo grubu; label sarmalayıcısı olmadan bir satır, seçenekler
              sağda daire olarak. Grup adı "anket-durum". */}
          <div className="form-satir">
            <span className="form-etiket">Durum</span>
            <div className="anket-radyo-grup">
              {DURUM_SECENEKLERI.map((secenek) => (
                <label key={secenek} className="anket-radyo-secenek">
                  <input
                    type="radio"
                    name="anket-durum"
                    value={secenek}
                    checked={form.durum === secenek}
                    onChange={() => alanGuncelle('durum', secenek)}
                  />
                  <span>{secenek}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Anket Tipi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
              "anket-tipi". */}
          <div className="form-satir">
            <span className="form-etiket">
              Anket Tipi <span className="zorunlu-yildiz">*</span>
            </span>
            <div className="anket-radyo-grup anket-radyo-grup--tip">
              {ANKET_TIPI_SECENEKLERI.map((secenek) => (
                <label key={secenek} className="anket-radyo-secenek">
                  <input
                    type="radio"
                    name="anket-tipi"
                    value={secenek}
                    checked={form.anket_tipi === secenek}
                    onChange={() => alanGuncelle('anket_tipi', secenek)}
                  />
                  <span>{secenek}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="form-satir">
            <span className="form-etiket">Erişim Seviyesi</span>
            <select
              className="form-kutu"
              value={form.erisim_seviyesi}
              onChange={(olay) =>
                alanGuncelle('erisim_seviyesi', olay.target.value)
              }
            >
              <option value="">Seçiniz</option>
              {ERISIM_SEVIYESI_SECENEKLERI.map((secenek) => (
                <option key={secenek} value={secenek}>
                  {secenek}
                </option>
              ))}
            </select>
          </label>
        </div>
        </AnketKart>

        {/* Sorular kartı: başlık zorunlu (kırmızı yıldız). İçerik ŞİMDİLİK yalnızca
            görsel iskelettir: "Excel ile yükle" ve "Yüklemek için tıklayınız"
            öğeleri İŞLEVSİZDİR (onClick yok), dosya seçici bile açmaz. Soru listesi
            state'i / iş kuralı yoktur; salt gösterim. */}
        <AnketKart
          baslik={
            <>
              Sorular <span className="zorunlu-yildiz">*</span>
            </>
          }
        >
          {/* Excel ile yükle: bağlantı görünümlü, tamamen görsel; tıklama hiçbir
              şey yapmaz. */}
          <div className="anket-sorular-arac-cubugu">
            <button type="button" className="baglanti-buton">
              Excel ile yükle
            </button>
          </div>

          {/* Boş durum: henüz soru yok. Bağlantı görünümlü buton işlevsizdir. */}
          <p className="anket-bos-durum">
            Soru bulunmamaktadır.{' '}
            <button type="button" className="baglanti-buton">
              Yüklemek için tıklayınız
            </button>
          </p>
        </AnketKart>

        {/* Tarihler kartı: Başlangıç ve Bitiş tarihi için zorunlu radyo grupları.
            "Tarih seç" işaretlenince takvim girdisi, o seçeneğin YANINDA (aynı satırda,
            sağında) KOŞULLU render edilir (diğer seçeneklerde hiç render edilmez).
            "Bugün", "Yarın", "Bir Ay", "İki Ay" için GERÇEK TARİH HESAPLANMAZ; yalnızca
            hangi seçeneğin seçildiği state'te tutulur, hesap ileride servise bırakılır. */}
        <AnketKart baslik="Tarihler">
          {/* Başlangıç Tarihi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
              "baslangic-tarihi". Seçenekler mevcut radyo kalıbıyla üretilir (DRY).
              "Tarih seç" seçeneğinin yanında, seçiliyken takvim girdisi görünür. */}
          <div className="form-satir">
            <span className="form-etiket">
              Başlangıç Tarihi <span className="zorunlu-yildiz">*</span>
            </span>
            <div className="anket-radyo-grup">
              {BASLANGIC_TARIHI_SECENEKLERI.map((secenek) => (
                <Fragment key={secenek.deger}>
                  <label className="anket-radyo-secenek">
                    <input
                      type="radio"
                      name="baslangic-tarihi"
                      value={secenek.deger}
                      checked={form.baslangic_secim === secenek.deger}
                      onChange={() =>
                        alanGuncelle('baslangic_secim', secenek.deger)
                      }
                    />
                    <span>{secenek.etiket}</span>
                  </label>
                  {/* Takvim yalnızca "Tarih seç" seçeneğinin yanında ve o seçim
                      işaretliyken görünür (koşullu render). */}
                  {secenek.deger === 'tarih_sec' &&
                    form.baslangic_secim === 'tarih_sec' && (
                      <input
                        className="form-kutu anket-tarih-secici"
                        type="date"
                        value={form.baslangic_tarih}
                        onChange={(olay) =>
                          alanGuncelle('baslangic_tarih', olay.target.value)
                        }
                      />
                    )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Başlangıç ve Bitiş bölümlerini görsel olarak ayıran ince çizgi. */}
          <div className="anket-tarih-ayirici" />

          {/* Bitiş Tarihi: zorunlu radyo grubu; varsayılan seçili yok. Grup adı
              "bitis-tarihi". "Tarih seç" seçeneğinin yanında, seçiliyken takvim
              girdisi görünür. */}
          <div className="form-satir">
            <span className="form-etiket">
              Bitiş Tarihi <span className="zorunlu-yildiz">*</span>
            </span>
            <div className="anket-radyo-grup">
              {BITIS_TARIHI_SECENEKLERI.map((secenek) => (
                <Fragment key={secenek.deger}>
                  <label className="anket-radyo-secenek">
                    <input
                      type="radio"
                      name="bitis-tarihi"
                      value={secenek.deger}
                      checked={form.bitis_secim === secenek.deger}
                      onChange={() => alanGuncelle('bitis_secim', secenek.deger)}
                    />
                    <span>{secenek.etiket}</span>
                  </label>
                  {/* Takvim yalnızca "Tarih seç" seçeneğinin yanında ve o seçim
                      işaretliyken görünür (koşullu render). */}
                  {secenek.deger === 'tarih_sec' &&
                    form.bitis_secim === 'tarih_sec' && (
                      <input
                        className="form-kutu anket-tarih-secici"
                        type="date"
                        value={form.bitis_tarih}
                        onChange={(olay) =>
                          alanGuncelle('bitis_tarih', olay.target.value)
                        }
                      />
                    )}
                </Fragment>
              ))}
            </div>
          </div>
        </AnketKart>

        {/* Kullanıcılar kartı: ankete kimlerin atanacağını belirleyen seçenekler.
            "Sabit liste" ve "Kullanıcı Grupları" checkbox'tır; İKİSİ DE aynı anda
            işaretlenebilir (bağımsız). Zorunlu değildir. Salt gösterimdir: gerçek
            atama/hesap YAPILMAZ, yalnızca seçim state'te tutulur; ileride atama
            akışına bağlanacaktır. */}
        <AnketKart baslik="Kullanıcılar">
          {/* Etiketsiz, dikey (alt alta) checkbox grubu: iki seçenek üst üste
              dizilir. Tek seçenek satırı (.anket-radyo-secenek) kalıbı korunur;
              yalnızca grup dikey yerleşim modifier'ıyla sütuna alınır. */}
          <div className="anket-radyo-grup anket-secenek-grup--dikey">
            {KULLANICI_ATAMA_SECENEKLERI.map((secenek) => (
              <label key={secenek.deger} className="anket-radyo-secenek">
                <input
                  type="checkbox"
                  name="kullanici-atama"
                  value={secenek.deger}
                  checked={form.kullanici_atama.includes(secenek.deger)}
                  onChange={() =>
                    cokluSeciminiDegistir('kullanici_atama', secenek.deger)
                  }
                />
                <span>{secenek.etiket}</span>
              </label>
            ))}
          </div>
        </AnketKart>

        {/* Mesaj Ayarları kartı: ankete dair mesaj/hatırlatma tercihleri. Üç BAĞIMSIZ
            checkbox alt alta dizilir (Kullanıcılar kartıyla aynı dikey grup kalıbı).
            Salt gösterimdir: GERÇEK MAIL/BİLDİRİM GÖNDERİLMEZ, yalnızca seçimler
            state'te tutulur; ileride mesaj akışına bağlanacaktır. */}
        <AnketKart baslik="Mesaj Ayarları">
          <div className="anket-radyo-grup anket-secenek-grup--dikey">
            {/* 1. Başlangıçtan 1 gün önce mail: bağımsız boolean checkbox. */}
            <label className="anket-radyo-secenek">
              <input
                type="checkbox"
                name="mesaj-baslangic-mail"
                checked={form.mesaj_baslangic_mail}
                onChange={() =>
                  alanGuncelle('mesaj_baslangic_mail', !form.mesaj_baslangic_mail)
                }
              />
              <span>
                Anket başlangıç tarihinden 1 gün önce kullanıcılara mail
                gönderilsin.
              </span>
            </label>

            {/* 2. Hatırlatma: checkbox + satır içi sayı girdisi ("kaç gün önce") ve
                sıklık dropdown'ı ("kaç günde bir"). Metin satır içinde akar, dar
                ekranda sarar. Sayı girdisi ve dropdown checkbox durumundan bağımsız
                olarak HER ZAMAN aktiftir. */}
            <div className="anket-hatirlatma-satir">
              <label className="anket-radyo-secenek">
                <input
                  type="checkbox"
                  name="mesaj-hatirlatma"
                  checked={form.mesaj_hatirlatma}
                  onChange={() =>
                    alanGuncelle('mesaj_hatirlatma', !form.mesaj_hatirlatma)
                  }
                />
                <span>Anket bitiminden</span>
              </label>
              {/* "gün önce" sayı girdisi: spinner'sız düz metin kutusu; yalnızca
                  rakam kabul eder (rakam dışı karakterler girişte temizlenir). */}
              <input
                className="form-kutu anket-hatirlatma-gun"
                type="text"
                inputMode="numeric"
                value={form.hatirlatma_gun_once}
                onChange={(olay) => gunOnceGuncelle(olay.target.value)}
              />
              <span className="anket-hatirlatma-metin">gün önce,</span>
              <select
                className="form-kutu anket-hatirlatma-siklik"
                value={form.hatirlatma_sikligi}
                onChange={(olay) =>
                  alanGuncelle('hatirlatma_sikligi', olay.target.value)
                }
              >
                {HATIRLATMA_SIKLIGI_SECENEKLERI.map((secenek) => (
                  <option key={secenek} value={secenek}>
                    {secenek}
                  </option>
                ))}
              </select>
              <span className="anket-hatirlatma-metin">
                günde bir hatırlatma mesajı (site içinde olacak)
              </span>
            </div>

            {/* Tek uyarı yuvası: satırın hemen altında kendi bloğunda görünsün diye
                sarmalayıcı div kullanılır. İki davranış aynı yerde toplanır:
                (1) rakam dışı girişte anlık kaybolan uyarı, (2) Kaydet'e basılınca
                boş kutu uyarısı. Girdi kalıbı KullaniciFormGovde ile aynı:
                .alan-uyari + role="status". */}
            {hatirlatmaGunUyariMesaji && (
              <div>
                <span className="alan-uyari" role="status">
                  {hatirlatmaGunUyariMesaji}
                </span>
              </div>
            )}

            {/* 3. Stil şablonu ile gönderim: bağımsız boolean checkbox. */}
            <label className="anket-radyo-secenek">
              <input
                type="checkbox"
                name="mesaj-stil-sablonu"
                checked={form.mesaj_stil_sablonu}
                onChange={() =>
                  alanGuncelle('mesaj_stil_sablonu', !form.mesaj_stil_sablonu)
                }
              />
              <span>Anket mesajları Stil şablonu ile gönderilsin.</span>
            </label>
          </div>
        </AnketKart>

        {/* İşlemler kartı: üstte dört BAĞIMSIZ işlem checkbox'ı (birden çoğu aynı anda
            işaretlenebilir; Kullanıcılar kartıyla aynı dikey grup kalıbı), altta ince
            ayırıcı çizgi, en altta soru gösterim biçimi için 3'lü radyo grubu (birbirini
            dışlar, varsayılan seçili). Salt gösterimdir: GERÇEK İŞLEV YOK, yalnızca
            seçimler state'te tutulur; ileride ilgili akışlara bağlanacaktır. */}
        <AnketKart baslik="İşlemler">
          {/* Etiketsiz, dikey (alt alta) checkbox grubu; her seçenek bağımsızdır. */}
          <div className="anket-radyo-grup anket-secenek-grup--dikey">
            {ISLEM_SECENEKLERI.map((secenek) => (
              <label key={secenek.deger} className="anket-radyo-secenek">
                <input
                  type="checkbox"
                  name="anket-islem"
                  value={secenek.deger}
                  checked={form.islem_secenekleri.includes(secenek.deger)}
                  onChange={() =>
                    cokluSeciminiDegistir('islem_secenekleri', secenek.deger)
                  }
                />
                <span>{secenek.etiket}</span>
              </label>
            ))}
          </div>

          {/* İşlem checkbox'larını soru gösterim radyolarından ayıran ince çizgi. */}
          <div className="anket-tarih-ayirici" />

          {/* Soru gösterim biçimi: birbirini dışlayan 3'lü radyo grubu; uzun
              seçenekler alt alta okunsun diye dikey grup kalıbı kullanılır. */}
          <div className="anket-radyo-grup anket-secenek-grup--dikey">
            {SORU_GOSTERIM_SECENEKLERI.map((secenek) => (
              <label key={secenek.deger} className="anket-radyo-secenek">
                <input
                  type="radio"
                  name="soru-gosterim"
                  value={secenek.deger}
                  checked={form.soru_gosterim === secenek.deger}
                  onChange={() => alanGuncelle('soru_gosterim', secenek.deger)}
                />
                <span>{secenek.etiket}</span>
              </label>
            ))}
          </div>
        </AnketKart>

        <div className="kullanici-ekle-butonlar">
          {/* Kaydet ŞİMDİLİK İŞLEVSİZ: backend/API henüz yok. Zorunlu alanlar
              dolmadıkça pasiftir (yalnızca UX). Aktif olduğunda da kayıt/gönderim
              YAPMAZ; gerçek kayıt akışı ileride API'ye bağlanacaktır. */}
          <span
            className="kaydet-sarmalayici"
            data-uyari={
              kaydetPasif ? 'Lütfen zorunlu alanları doldurun' : undefined
            }
          >
            <button
              type="button"
              className="birincil-buton"
              disabled={kaydetPasif}
              onClick={() => setKaydetDenendi(true)}
            >
              Kaydet
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
