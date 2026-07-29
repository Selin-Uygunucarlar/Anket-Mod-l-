// Anket doldurma ekranında TEK bir soruyu ve ona uygun girdi alanını gösteren
// sunum bileşeni. Soru tipine göre doğru girdiyi (radyo / dropdown / checkbox /
// metin kutusu) çizer ve kullanıcının seçimini üst bileşene (AnketDoldurForm)
// iletir. Yalnızca gösterim ve girdi toplama sorumluluğundadır: iş kuralı,
// hesaplama, doğrulama veya API çağrısı İÇERMEZ (zorunluluk/kardinalite/aidiyet
// kararları sunucuya aittir). soru_metni/secenek_metni sunucuda SANITIZE EDİLMİŞ
// HTML'dir; UI onu yeniden işlemeden gösterir (AnketKullaniciCevaplariKutusu ile
// aynı dangerouslySetInnerHTML kalıbı). Görünüm Ant Design bileşenleriyle kurulur
// (Card/Radio/Checkbox/Select/Input.TextArea); tema ConfigProvider token'larından
// gelir, bu bileşene ait özel CSS dosyası YOKTUR.

import { Alert, Card, Checkbox, Flex, Input, Radio, Select, Typography, theme } from 'antd'

const { Text } = Typography
const { TextArea } = Input

// TEKIL_SECIM_TIPLERI: kullanıcının tam olarak bir şık seçtiği (radyo/dropdown)
// soru tipleri. Dropdown yalnızca 'listeden_secmeli'dir; diğerleri radyo grubudur.
const TEKIL_SECIM_TIPLERI = ['coktan_secmeli_tek', 'evet_hayir', 'skala_5']

// htmlDenDuzMetin: sunucuda sanitize edilmiş HTML şık metnini, HTML gösteremeyen
// Select seçeneğinde kullanmak üzere düz metne indirger. Salt gösterim
// dönüşümüdür; içeriği doğrulamaz. DOMParser tarayıcıda mevcuttur; boş/etiketsiz
// metinde ham değeri döndürür.
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
function RadyoGrubu({ secenekler, deger, saltOkunur, onSecimDegis }) {
  const seciliId = deger.secenek_idler[0] ?? null
  return (
    <Radio.Group
      vertical
      value={seciliId}
      disabled={saltOkunur}
      onChange={(olay) => onSecimDegis([olay.target.value])}
    >
      {secenekler.map((secenek) => (
        <Radio key={secenek.secenek_id} value={secenek.secenek_id}>
          <span dangerouslySetInnerHTML={{ __html: secenek.secenek_metni }} />
        </Radio>
      ))}
    </Radio.Group>
  )
}

// CokluSecim: çoklu seçimli (checkbox) soru için şıkları çizer. Bir şık işaretlenip
// kaldırıldıkça deger.secenek_idler listesi güncellenir. Şık metni HTML render.
function CokluSecim({ secenekler, deger, saltOkunur, onSecimDegis }) {
  return (
    <Checkbox.Group
      value={deger.secenek_idler}
      disabled={saltOkunur}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      onChange={onSecimDegis}
    >
      {secenekler.map((secenek) => (
        <Checkbox key={secenek.secenek_id} value={secenek.secenek_id}>
          <span dangerouslySetInnerHTML={{ __html: secenek.secenek_metni }} />
        </Checkbox>
      ))}
    </Checkbox.Group>
  )
}

// ListedenSecim: 'listeden_secmeli' için açılır kutu çizer. antd Select seçenek
// etiketini HTML gösteremez; bu yüzden şık metni düz metne indirgenir (bkz. D11).
function ListedenSecim({ secenekler, deger, saltOkunur, onSecimDegis }) {
  const seciliId = deger.secenek_idler[0] ?? undefined

  return (
    <Select
      value={seciliId}
      disabled={saltOkunur}
      allowClear
      placeholder="Seçiniz..."
      aria-label="Seçiminizi yapın"
      style={{ width: '100%' }}
      options={secenekler.map((secenek) => ({
        value: secenek.secenek_id,
        label: htmlDenDuzMetin(secenek.secenek_metni),
      }))}
      // Boş seçim (temizleme) cevabı temizler.
      onChange={(secimDegeri) => onSecimDegis(secimDegeri === undefined ? [] : [secimDegeri])}
    />
  )
}

// YorumKutusu: 'yorum' tipi için serbest metin girişi. Metin
// deger.cevap_metni'ne yazılır.
function YorumKutusu({ deger, saltOkunur, onMetinDegis }) {
  return (
    <TextArea
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
// props: sira -> 1'den başlayan görünen sıra numarası; soru -> { soru_id,
//   soru_metni, soru_tipi, zorunlu_mu, sira_no, secenekler }; deger ->
//   { secenek_idler: number[], cevap_metni: string }; onDegis(yeniDeger) -> girdi
//   değişince çağrılır (üst bileşen state'i tutar); hataVar -> zorunlu soru boş
//   bırakıldığında görsel vurgulama için bool; saltOkunur -> anket zaten
//   tamamlandıysa girdileri kilitler.
function AnketDoldurSoruKarti({ sira, soru, deger, onDegis, hataVar, saltOkunur }) {
  const secenekler = secenekleriSirala(soru.secenekler)
  const { token } = theme.useToken()

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

  return (
    <Card
      size="small"
      style={{
        borderColor: hataVar ? token.colorError : token.colorBorder,
        background: hataVar ? token.colorErrorBg : token.colorBgContainer,
      }}
    >
      <Flex vertical gap={10}>
        <Text strong>
          {`${sira}. `}
          {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir; UI yeniden işlemez. */}
          <span dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
          {soru.zorunlu_mu ? (
            <Text type="danger" aria-hidden="true">
              {' *'}
            </Text>
          ) : null}
        </Text>
        {girdiAlani}
        {hataVar ? (
          <Alert type="error" showIcon title="Bu soru zorunludur." />
        ) : null}
      </Flex>
    </Card>
  )
}

export default AnketDoldurSoruKarti
