// Anket formunun "Mesaj Ayarları" kartı: ankete dair mesaj/hatırlatma tercihlerini
// gösterir ve girdi toplar. Üç BAĞIMSIZ checkbox alt alta dizilir. Salt gösterimdir:
// GERÇEK MAIL/BİLDİRİM GÖNDERİLMEZ ve bu seçimler SUNUCUYA GÖNDERİLMEZ; yalnızca
// seçimler state'te tutulur, ileride mesaj akışına bağlanacaktır. AnketEkleForm'dan
// ayrı dosyadadır çünkü tek bir işi vardır ve "gün önce" kutusunun anlık rakam
// uyarısı da yalnızca bu bölüme aittir (SRP; uyarı state'i burada yaşar).
// Görünüm sınıfları kullanici-ekle.css + anket-ekle.css'ten paylaşılır (DRY).

import { useEffect, useRef, useState } from 'react'
import AnketKart from './AnketKart'
import {
  HATIRLATMA_SIKLIGI_SECENEKLERI,
  UYARI_SURESI_MS,
} from '../common/anketFormAlanlari.js'
import '../styles/kullanici-ekle.css'
import '../styles/anket-ekle.css'

// AnketMesajAyarlariKarti: mesaj/hatırlatma seçeneklerini render eder ve "gün önce"
// kutusunun rakam uyarısını yönetir.
// props: form -> form state'i (yalnızca okunur); alanGuncelle(kimlik, deger) ->
//   tek alan değişimini üst bileşene bildirir; kaydetDenendi -> Kaydet'e en az bir
//   kez basıldı mı (boş kutu uyarısı yalnızca basıldıktan sonra görünsün diye).
function AnketMesajAyarlariKarti({ form, alanGuncelle, kaydetDenendi }) {
  // "gün önce" kutusuna rakam dışı karakter girildiğinde kısa süre görünüp
  // kendiliğinden kaybolan anlık uyarı mesajı (boşsa uyarı yok). Tek alan için.
  const [rakamUyarisi, setRakamUyarisi] = useState('')
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
            Anket başlangıç tarihinden 1 gün önce kullanıcılara mail gönderilsin.
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
  )
}

export default AnketMesajAyarlariKarti
