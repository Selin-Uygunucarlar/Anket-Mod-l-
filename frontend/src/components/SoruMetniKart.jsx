// Anket sorusu metnini zengin biçimde (kalın, italik, altı çizili, madde/numaralı
// liste, font boyutu, yazı rengi, hizalama, link) yazıp düzenlemeye yarayan,
// kontrollü ve yeniden kullanılabilir bir SUNUM kartıdır. Kendi kart çerçevesine
// sahiptir; başka bir kart bileşenine BAĞIMLI DEĞİLDİR, bağımsız da kullanılabilir.
//
// Katman: yalnızca UI. İş kuralı, hesaplama veya doğrulama sınırı İÇERMEZ; metni
// sunar ve girdiyi toplar. İçerik yalnızca üst bileşenin state'inde tutulur; bu
// bileşen backend/API çağırmaz ve gerçek kayıt yapmaz.
//
// Biçimlendirme, kütüphane eklememek için tarayıcının contentEditable +
// document.execCommand yolu ile yapılır (deprecated olsa da kütüphanesiz standart
// yoldur). Bu mantık tek dosyada izole tutulur; ileride bir editör kütüphanesine
// geçilmek istenirse yalnızca bu bileşen değişir (gevşek bağlılık).
//
// GÜVENLİK VARSAYIMI: Üretilen HTML burada SANİTİZE EDİLMEZ. Bu içerik ileride
// sunucuya kaydedilip başka kullanıcılara gösterilecekse, XSS'e karşı asıl
// temizleme/sanitizasyon SUNUCU TARAFINDA yapılmalıdır; UI'daki client kontrolü
// bir güvenlik sınırı değildir.

import { useEffect, useRef } from 'react'
import {
  METIN_BICIM_KOMUTLARI,
  LISTE_KOMUTLARI,
  HIZALAMA_KOMUTLARI,
  FONT_BOYUTU_SECENEKLERI,
  VARSAYILAN_FONT_BOYUTU,
} from '../common/soruBicimlendirmeAraclari.js'
import '../styles/soru-metni-kart.css'

// SoruMetniKart: başlıklı bir kart içinde biçimlendirme araç çubuğu ve zengin
// metin yazım alanı gösterir.
// props:
//   deger       -> gösterilecek HTML içerik (string, kontrollü değer)
//   onDegisim   -> içerik değişince yeni HTML'i üst bileşene veren fonksiyon
//   baslik      -> (opsiyonel) kart üst başlığı; verilmezse başlık render edilmez
//   placeholder -> (opsiyonel) alan boşken görünen ipucu metni
function SoruMetniKart({ deger, onDegisim, baslik, placeholder }) {
  // contentEditable yazım alanının DOM referansı (execCommand hedefi).
  const editorRef = useRef(null)
  // Editör içindeki son geçerli seçim aralığı. Font boyutu select'i veya renk
  // input'u tıklanınca odak editörden çıkar ve seçim kaybolur; komut uygulanmadan
  // önce bu aralık geri yüklenerek biçim doğru metne uygulanır.
  const secimAralikRef = useRef(null)

  // Dışarıdan gelen `deger` editörün mevcut içeriğinden farklıysa alana yazar.
  // Kullanıcı yazarken onInput -> onDegisim -> deger aynı HTML'e döndüğünden bu
  // koşul çoğu tuşta sağlanmaz; böylece innerHTML yeniden yazılıp imleç sıçramaz.
  useEffect(() => {
    const editor = editorRef.current
    if (editor && editor.innerHTML !== (deger ?? '')) {
      editor.innerHTML = deger ?? ''
    }
  }, [deger])

  // secimiKaydet: geçerli seçim editörün içindeyse aralığı saklar. Buton/select
  // etkileşiminden önce seçimi geri yükleyebilmek için tutulur.
  function secimiKaydet() {
    const secim = window.getSelection()
    if (!secim || secim.rangeCount === 0) return
    const aralik = secim.getRangeAt(0)
    if (editorRef.current && editorRef.current.contains(aralik.commonAncestorContainer)) {
      secimAralikRef.current = aralik
    }
  }

  // bicimDegisiminiBildir: editörün güncel HTML'ini üst bileşene iletir ve son
  // seçimi tazeler. Her biçim komutundan ve doğrudan yazımdan sonra çağrılır.
  function bicimDegisiminiBildir() {
    if (editorRef.current) {
      onDegisim(editorRef.current.innerHTML)
    }
    secimiKaydet()
  }

  // komutUygula: verilen execCommand komutunu (opsiyonel değerle) editördeki
  // seçime uygular. Önce odağı editöre alır ve saklı seçimi geri yükler; böylece
  // odak araç çubuğu öğesine geçmiş olsa bile biçim doğru metne uygulanır.
  function komutUygula(komut, komutDegeri) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const kayitliAralik = secimAralikRef.current
    if (kayitliAralik) {
      const secim = window.getSelection()
      secim.removeAllRanges()
      secim.addRange(kayitliAralik)
    }
    document.execCommand(komut, false, komutDegeri)
    bicimDegisiminiBildir()
  }

  // baglantiEkle: kullanıcıdan bir adres alıp seçili metni bağlantıya dönüştürür.
  // Adres boş bırakılırsa hiçbir şey yapılmaz.
  function baglantiEkle() {
    const adres = window.prompt('Bağlantı adresini girin (https://...)')
    if (adres && adres.trim() !== '') {
      komutUygula('createLink', adres.trim())
    }
  }

  return (
    <section className="soru-metni-kart">
      {baslik && <h4 className="soru-metni-baslik">{baslik}</h4>}

      {/* Araç çubuğu: butonlar onMouseDown'da preventDefault ile odağı editörde
          tutar (seçim korunur). Font boyutu ve renk odağı aldığından saklı seçim
          komut anında geri yüklenir. */}
      <div className="soru-metni-arac-cubugu">
        {METIN_BICIM_KOMUTLARI.map((arac) => (
          <button
            key={arac.komut}
            type="button"
            className="soru-metni-arac-buton"
            title={arac.ipucu}
            aria-label={arac.ipucu}
            onMouseDown={(olay) => olay.preventDefault()}
            onClick={() => komutUygula(arac.komut)}
          >
            {arac.etiket}
          </button>
        ))}

        <span className="soru-metni-ayirici" aria-hidden="true" />

        {LISTE_KOMUTLARI.map((arac) => (
          <button
            key={arac.komut}
            type="button"
            className="soru-metni-arac-buton"
            title={arac.ipucu}
            aria-label={arac.ipucu}
            onMouseDown={(olay) => olay.preventDefault()}
            onClick={() => komutUygula(arac.komut)}
          >
            {arac.etiket}
          </button>
        ))}

        <span className="soru-metni-ayirici" aria-hidden="true" />

        {HIZALAMA_KOMUTLARI.map((arac) => (
          <button
            key={arac.komut}
            type="button"
            className="soru-metni-arac-buton"
            title={arac.ipucu}
            aria-label={arac.ipucu}
            onMouseDown={(olay) => olay.preventDefault()}
            onClick={() => komutUygula(arac.komut)}
          >
            {arac.etiket}
          </button>
        ))}

        <span className="soru-metni-ayirici" aria-hidden="true" />

        {/* Font boyutu: seçim yapılınca değeri editördeki seçime uygular; dropdown
            kontrolsüz kalır (varsayılana geri döner) çünkü boyut, kalıcı bir alan
            değeri değil o anki seçime uygulanan bir biçimdir. */}
        <select
          className="soru-metni-secim"
          title="Font boyutu"
          aria-label="Font boyutu"
          value={VARSAYILAN_FONT_BOYUTU}
          onChange={(olay) => komutUygula('fontSize', olay.target.value)}
        >
          {FONT_BOYUTU_SECENEKLERI.map((secenek) => (
            <option key={secenek.deger} value={secenek.deger}>
              {secenek.etiket}
            </option>
          ))}
        </select>

        {/* Yazı rengi: renk seçici; seçilen renk editördeki seçime uygulanır. */}
        <label className="soru-metni-renk" title="Yazı rengi">
          <span className="soru-metni-renk-etiket" aria-hidden="true">
            Renk
          </span>
          <input
            type="color"
            aria-label="Yazı rengi"
            onChange={(olay) => komutUygula('foreColor', olay.target.value)}
          />
        </label>

        <span className="soru-metni-ayirici" aria-hidden="true" />

        <button
          type="button"
          className="soru-metni-arac-buton"
          title="Bağlantı ekle"
          aria-label="Bağlantı ekle"
          onMouseDown={(olay) => olay.preventDefault()}
          onClick={baglantiEkle}
        >
          Bağlantı
        </button>
      </div>

      {/* Yazım alanı: contentEditable. Boşken data-placeholder ipucu CSS ile
          gösterilir. Yazdıkça onInput üst bileşene HTML'i bildirir; seçim
          değişiminde saklı aralık güncellenir. */}
      <div
        ref={editorRef}
        className="soru-metni-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={baslik || 'Soru metni'}
        data-placeholder={placeholder || ''}
        onInput={bicimDegisiminiBildir}
        onKeyUp={secimiKaydet}
        onMouseUp={secimiKaydet}
      />
    </section>
  )
}

export default SoruMetniKart
