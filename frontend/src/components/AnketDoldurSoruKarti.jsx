// Anket doldurma ekranında TEK bir soruyu ve ona uygun girdi alanını gösteren
// sunum bileşeni. Soru tipine göre doğru girdiyi (radyo / dropdown / checkbox /
// metin kutusu) çizer ve kullanıcının seçimini üst bileşene (AnketDoldurForm)
// iletir. Yalnızca gösterim ve girdi toplama sorumluluğundadır: iş kuralı,
// hesaplama, doğrulama veya API çağrısı İÇERMEZ (zorunluluk/kardinalite/aidiyet
// kararları sunucuya aittir). soru_metni/secenek_metni sunucuda SANITIZE EDİLMİŞ
// HTML'dir; UI onu yeniden işlemeden gösterir (AnketSorulariKarti/SoruListesi ile
// aynı dangerouslySetInnerHTML kalıbı).

import '../styles/anket-doldur.css'

// TEKIL_SECIM_TIPLERI: kullanıcının tam olarak bir şık seçtiği (radyo/dropdown)
// soru tipleri. Dropdown yalnızca 'listeden_secmeli'dir; diğerleri radyo grubudur.
const TEKIL_SECIM_TIPLERI = ['coktan_secmeli_tek', 'evet_hayir', 'skala_5']

// htmlDenDuzMetin: sunucuda sanitize edilmiş HTML şık metnini, HTML gösteremeyen
// <option> içinde kullanmak üzere düz metne indirger. Salt gösterim dönüşümüdür;
// içeriği doğrulamaz. DOMParser tarayıcıda mevcuttur; boş/etiketsiz metinde ham
// değeri döndürür.
function htmlDenDuzMetin(html) {
  if (!html) {
    return ''
  }
  const belge = new DOMParser().parseFromString(html, 'text/html')
  return (belge.body.textContent || '').trim()
}

// secenekleriSirala: şıkları sira_no'ya göre (boş sona) kararlı sıralar. Backend
// zaten sıralı gönderir; UI görünüm tutarlılığı için yeniden sıralar (stabil).
function secenekleriSirala(secenekler) {
  return [...(secenekler ?? [])].sort((a, b) => {
    const sa = a.sira_no ?? Number.MAX_SAFE_INTEGER
    const sb = b.sira_no ?? Number.MAX_SAFE_INTEGER
    return sa - sb
  })
}

// RadyoGrubu: tek seçimli (radyo) soru tipleri için şık listesini çizer. Seçili
// şık deger.secenek_idler[0]'dır. Şık metni HTML olarak render edilir.
function RadyoGrubu({ soru, secenekler, deger, saltOkunur, onSecimDegis }) {
  const seciliId = deger.secenek_idler[0] ?? null
  return (
    <div className="anket-doldur-secenekler" role="radiogroup">
      {secenekler.map((secenek) => (
        <label key={secenek.secenek_id} className="anket-doldur-secenek">
          <input
            type="radio"
            name={`soru-${soru.soru_id}`}
            className="anket-doldur-radyo"
            checked={seciliId === secenek.secenek_id}
            disabled={saltOkunur}
            onChange={() => onSecimDegis([secenek.secenek_id])}
          />
          <span
            className="anket-doldur-secenek-metin"
            dangerouslySetInnerHTML={{ __html: secenek.secenek_metni }}
          />
        </label>
      ))}
    </div>
  )
}

// CokluSecim: çoklu seçimli (checkbox) soru için şıkları çizer. Bir şık işaretlenip
// kaldırıldıkça deger.secenek_idler listesi güncellenir. Şık metni HTML render.
function CokluSecim({ secenekler, deger, saltOkunur, onSecimDegis }) {
  // secimiDegistir: bir şıkkı seçili listeye ekler/çıkarır (ekleme/kaldırma UX'i;
  // iş kuralı değil).
  function secimiDegistir(secenekId, isaretli) {
    const yeni = isaretli
      ? [...deger.secenek_idler, secenekId]
      : deger.secenek_idler.filter((id) => id !== secenekId)
    onSecimDegis(yeni)
  }

  return (
    <div className="anket-doldur-secenekler">
      {secenekler.map((secenek) => (
        <label key={secenek.secenek_id} className="anket-doldur-secenek">
          <input
            type="checkbox"
            className="anket-doldur-kutu"
            checked={deger.secenek_idler.includes(secenek.secenek_id)}
            disabled={saltOkunur}
            onChange={(olay) => secimiDegistir(secenek.secenek_id, olay.target.checked)}
          />
          <span
            className="anket-doldur-secenek-metin"
            dangerouslySetInnerHTML={{ __html: secenek.secenek_metni }}
          />
        </label>
      ))}
    </div>
  )
}

// ListedenSecim: 'listeden_secmeli' için <select> çizer. <option> HTML gösteremez;
// bu yüzden şık metni düz metne indirgenir.
function ListedenSecim({ secenekler, deger, saltOkunur, onSecimDegis }) {
  const seciliId = deger.secenek_idler[0] ?? ''

  // secimiUygula: dropdown değeri değişince seçilen şık kimliğini üst bileşene
  // iletir; boş seçim cevabı temizler.
  function secimiUygula(deger) {
    onSecimDegis(deger === '' ? [] : [Number(deger)])
  }

  return (
    <select
      className="anket-doldur-select"
      value={seciliId}
      disabled={saltOkunur}
      aria-label="Seçiminizi yapın"
      onChange={(olay) => secimiUygula(olay.target.value)}
    >
      <option value="">Seçiniz...</option>
      {secenekler.map((secenek) => (
        <option key={secenek.secenek_id} value={secenek.secenek_id}>
          {htmlDenDuzMetin(secenek.secenek_metni)}
        </option>
      ))}
    </select>
  )
}

// YorumKutusu: 'yorum' tipi için serbest metin girişi (<textarea>). Metin
// deger.cevap_metni'ne yazılır.
function YorumKutusu({ deger, saltOkunur, onMetinDegis }) {
  return (
    <textarea
      className="anket-doldur-textarea"
      rows={4}
      value={deger.cevap_metni}
      disabled={saltOkunur}
      placeholder="Cevabınızı buraya yazın..."
      aria-label="Yorumunuz"
      onChange={(olay) => onMetinDegis(olay.target.value)}
    />
  )
}

// AnketDoldurSoruKarti: bir soruyu (metni HTML) ve tipine uygun girdiyi gösterir.
// props: soru -> { soru_id, soru_metni, soru_tipi, zorunlu_mu, sira_no, secenekler };
//   deger -> { secenek_idler: number[], cevap_metni: string }; onDegis(yeniDeger) ->
//   girdi değişince çağrılır (üst bileşen state'i tutar); hataVar -> zorunlu soru
//   boş bırakıldığında görsel vurgulama için bool; saltOkunur -> anket zaten
//   tamamlandıysa girdileri kilitler.
function AnketDoldurSoruKarti({ soru, deger, onDegis, hataVar, saltOkunur }) {
  const secenekler = secenekleriSirala(soru.secenekler)

  // onSecimDegis / onMetinDegis: alt girdilerden gelen değişimi tam cevap
  // nesnesine sarıp üst bileşene iletir (state şekli tek yerde korunur).
  function onSecimDegis(yeniSecenekIdler) {
    onDegis({ secenek_idler: yeniSecenekIdler, cevap_metni: '' })
  }
  function onMetinDegis(yeniMetin) {
    onDegis({ secenek_idler: [], cevap_metni: yeniMetin })
  }

  // Soru tipine göre uygun girdi alanını seç.
  let girdiAlani
  if (soru.soru_tipi === 'yorum') {
    girdiAlani = (
      <YorumKutusu deger={deger} saltOkunur={saltOkunur} onMetinDegis={onMetinDegis} />
    )
  } else if (soru.soru_tipi === 'coktan_secmeli_coklu') {
    girdiAlani = (
      <CokluSecim
        secenekler={secenekler}
        deger={deger}
        saltOkunur={saltOkunur}
        onSecimDegis={onSecimDegis}
      />
    )
  } else if (soru.soru_tipi === 'listeden_secmeli') {
    girdiAlani = (
      <ListedenSecim
        secenekler={secenekler}
        deger={deger}
        saltOkunur={saltOkunur}
        onSecimDegis={onSecimDegis}
      />
    )
  } else if (TEKIL_SECIM_TIPLERI.includes(soru.soru_tipi)) {
    girdiAlani = (
      <RadyoGrubu
        soru={soru}
        secenekler={secenekler}
        deger={deger}
        saltOkunur={saltOkunur}
        onSecimDegis={onSecimDegis}
      />
    )
  } else {
    // Bilinmeyen tip: girdi gösterilmez ama soru metni yine görünür (gösterim
    // boşa düşmez). Backend grid'i zaten göndermez; başka tip beklenmez.
    girdiAlani = null
  }

  const kartSinifi = `anket-doldur-soru${hataVar ? ' anket-doldur-soru-hatali' : ''}`

  return (
    <li className={kartSinifi}>
      <div className="anket-doldur-soru-metin">
        {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir; UI yeniden işlemez. */}
        <span dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
        {soru.zorunlu_mu ? (
          <span className="zorunlu-yildiz" aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </div>
      {girdiAlani}
      {hataVar ? (
        <p className="anket-doldur-soru-uyari">Bu soru zorunludur.</p>
      ) : null}
    </li>
  )
}

export default AnketDoldurSoruKarti
