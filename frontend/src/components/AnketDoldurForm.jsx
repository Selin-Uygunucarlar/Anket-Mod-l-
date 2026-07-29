// Anket doldurma formunun kapsayıcısı: bir anketin sorularını sıralı gösterir,
// kullanıcının cevaplarını toplar ve TEK SEFERDE backend'e gönderir. Yalnızca
// sunum ve girdi toplama sorumluluğundadır; iş kuralı/hesaplama İÇERMEZ. Zorunlu
// alan uyarısı burada YALNIZCA erken bir UX geri bildirimidir (basit boş kontrolü);
// asıl doğrulama (kardinalite, aidiyet, tarih/durum, zorunluluk) SUNUCUDADIR ve
// sunucu yanıtı esas alınır. Gönderim @tanstack/react-query mutation'ı ile yapılır.
// Görünüm Ant Design bileşenleriyle kurulur (Alert/Button/Empty); tema
// ConfigProvider token'larından gelir, bu bileşene ait özel CSS dosyası YOKTUR.

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Empty, Flex } from 'antd'
import { anketCevaplariGonder } from '../api/anketApi.js'
import AnketDoldurSoruKarti from './AnketDoldurSoruKarti'

// sorulariSirala: soruları sira_no'ya göre (boş sona) kararlı sıralar. Backend
// zaten sıralı gönderir; görünüm tutarlılığı için yeniden sıralanır (stabil).
function sorulariSirala(sorular) {
  return [...(sorular ?? [])].sort((a, b) => {
    const sa = a.sira_no ?? Number.MAX_SAFE_INTEGER
    const sb = b.sira_no ?? Number.MAX_SAFE_INTEGER
    return sa - sb
  })
}

// baslangicCevaplari: her soru için boş cevap state'i kurar
// ({ secenek_idler: [], cevap_metni: '' }); soru_id ile anahtarlanır.
function baslangicCevaplari(sorular) {
  const cevaplar = {}
  for (const soru of sorular ?? []) {
    cevaplar[soru.soru_id] = { secenek_idler: [], cevap_metni: '' }
  }
  return cevaplar
}

// soruCevaplanmisMi: bir sorunun kullanıcı tarafından cevaplanıp cevaplanmadığını
// söyler (en az bir şık seçili VEYA metin dolu). Salt gösterim/UX kontrolüdür;
// gerçek zorunluluk kararı sunucuya aittir.
function soruCevaplanmisMi(cevap) {
  if (!cevap) {
    return false
  }
  return cevap.secenek_idler.length > 0 || cevap.cevap_metni.trim() !== ''
}

// AnketDoldurForm: anket görünümünü alıp cevap formunu yönetir.
// props: anket -> { anket_id, ad, son_yazi, sorular: [...] } (sunucudan gelen
//   güvenli görünüm); onBasarili() -> gönderim başarıyla tamamlanınca çağrılır
//   (üst sayfa yönlendirme/teşekkür gösterir); saltOkunur -> anket zaten
//   tamamlandıysa (tamamlandi_mi) girdiler kilitlenir ve Gönder gizlenir; sorular
//   yalnızca referans için gösterilir.
function AnketDoldurForm({ anket, onBasarili, saltOkunur = false }) {
  const sorular = sorulariSirala(anket.sorular)
  const [cevaplar, setCevaplar] = useState(() => baslangicCevaplari(sorular))
  // eksikSoruIdler: zorunlu olup boş bırakılan soruların kimlikleri (UX vurgusu).
  const [eksikSoruIdler, setEksikSoruIdler] = useState([])
  const [uyariMetni, setUyariMetni] = useState('')

  const gonderMutation = useMutation({
    mutationFn: (gonderilecekCevaplar) =>
      anketCevaplariGonder(anket.anket_id, gonderilecekCevaplar),
    onSuccess: () => {
      onBasarili()
    },
  })

  // soruCevabiniGuncelle: tek bir sorunun cevabını state'te değiştirir ve o soru
  // eksik işaretliyse uyarıyı kaldırır (kullanıcı doldurunca vurgu düşsün).
  function soruCevabiniGuncelle(soruId, yeniDeger) {
    setCevaplar((oncekiler) => ({ ...oncekiler, [soruId]: yeniDeger }))
    setEksikSoruIdler((oncekiler) => oncekiler.filter((id) => id !== soruId))
  }

  // gonderimiBaslat: zorunlu soruları erken kontrol eder (UX); eksik varsa gönderim
  // yapmadan uyarır. Eksik yoksa yalnız cevaplanmış soruları paket haline getirip
  // gönderir (boş/zorunsuz sorular gönderilmez; sunucu bunları cevapsız kabul eder).
  function gonderimiBaslat(olay) {
    olay.preventDefault()

    const eksikler = sorular
      .filter((soru) => soru.zorunlu_mu && !soruCevaplanmisMi(cevaplar[soru.soru_id]))
      .map((soru) => soru.soru_id)

    if (eksikler.length > 0) {
      setEksikSoruIdler(eksikler)
      setUyariMetni('Lütfen zorunlu (*) soruları cevaplayın.')
      return
    }

    const gonderilecekCevaplar = sorular
      .filter((soru) => soruCevaplanmisMi(cevaplar[soru.soru_id]))
      .map((soru) => {
        const cevap = cevaplar[soru.soru_id]
        const metin = cevap.cevap_metni.trim()
        return {
          soru_id: soru.soru_id,
          secenek_idler: cevap.secenek_idler,
          cevap_metni: metin === '' ? null : metin,
        }
      })

    setUyariMetni('')
    gonderMutation.mutate(gonderilecekCevaplar)
  }

  // Gönderim sırasında VEYA anket zaten tamamlandıysa girdiler kilitlenir.
  const girdilerKilitli = gonderMutation.isPending || saltOkunur

  return (
    <form onSubmit={gonderimiBaslat} noValidate>
      <Flex vertical gap={16}>
        {sorular.length === 0 ? (
          <Empty description="Bu ankette gösterilecek soru bulunmuyor." />
        ) : (
          <Flex vertical gap={16} component="ol" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {sorular.map((soru, index) => (
              <AnketDoldurSoruKarti
                key={soru.soru_id}
                sira={index + 1}
                soru={soru}
                deger={cevaplar[soru.soru_id]}
                onDegis={(yeniDeger) => soruCevabiniGuncelle(soru.soru_id, yeniDeger)}
                hataVar={eksikSoruIdler.includes(soru.soru_id)}
                saltOkunur={girdilerKilitli}
              />
            ))}
          </Flex>
        )}

        {/* İstemci tarafı erken uyarı (yalnız UX). */}
        {uyariMetni ? <Alert type="error" showIcon title={uyariMetni} role="alert" /> : null}

        {/* Sunucudan gelen güvenli hata mesajı (400/409/404 anlamlı Türkçe metni). */}
        {gonderMutation.isError ? (
          <Alert type="error" showIcon title={gonderMutation.error.message} role="alert" />
        ) : null}

        {/* Anket tamamlandıysa Gönder gizlenir (yeniden gönderim yok); aksi halde
            gönderim sırasında pasifleşir. */}
        {sorular.length > 0 && !saltOkunur ? (
          <Flex justify="flex-end">
            <Button type="primary" htmlType="submit" disabled={gonderMutation.isPending}>
              {gonderMutation.isPending ? 'Gönderiliyor...' : 'Gönder'}
            </Button>
          </Flex>
        ) : null}
      </Flex>
    </form>
  )
}

export default AnketDoldurForm
