// Bir kullanıcının BİR anketteki cevaplarını gösteren kutu (modal). Atama
// kutusundaki "Cevapları Gör" butonuyla, o kutunun üstünde açılır. Yalnızca sunum
// sorumluluğundadır: anketApi üzerinden cevapları ister ve soru sırasıyla gösterir;
// iş kuralı, yetki kararı veya hesaplama İÇERMEZ (yetki sunucuda uygulanır).
// soru_metni / verilen_secenekler / cevap_metni SUNUCUDA SANITIZE EDİLMİŞ HTML'dir;
// AnketDoldurSoruKarti'ndaki kalıpla dangerouslySetInnerHTML ile gösterilir (UI'da
// ek sanitizasyon yapılmaz, var olan kaldırılmaz).
// Cevapsız sorular listede kalır ve "Cevaplanmamış" olarak işaretlenir; kişi anketi
// tamamlamamışsa (tamamlandi_mi=false) cevapların eksik olabileceği not edilir.
// Görünüm Ant Design bileşenleriyle kurulur (Modal + Alert + Typography); tema
// ConfigProvider token'larından gelir, bu kutuya ait özel CSS dosyası YOKTUR.
// Escape / perdeye tıklama / "Kapat" ile kapanır (en üstteki kutu odur).

import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Divider, Empty, Flex, Modal, Spin, Typography } from 'antd'
import { kullaniciCevaplariniGetir } from '../api/anketApi.js'
import { adSoyadBirlestir } from '../common/metinBicimlendir.js'

const { Text } = Typography

// Kutunun genişliği: uzun soru metinleri ve cevaplar rahat okunsun.
const KUTU_GENISLIGI = 900

// VerilenCevap: tek bir sorunun cevap gövdesini çizer. Şık(lar) ve serbest metin
// birlikte gelebilir; ikisi de yoksa görünür bir "Cevaplanmamış" ibaresi konur.
function VerilenCevap({ soru }) {
  const secenekler = soru.verilen_secenekler ?? []
  const metin = soru.cevap_metni

  if (secenekler.length === 0 && !metin) {
    return <Text type="secondary">Cevaplanmamış</Text>
  }

  return (
    <>
      {secenekler.length > 0 && (
        <ul style={{ margin: 0, paddingInlineStart: 20 }}>
          {secenekler.map((secenekMetni, sira) => (
            // Şık metni sunucuda sanitize edilmiş HTML'dir; UI yeniden işlemez.
            // Aynı metin tekrar edebileceğinden anahtar sıra ile birleştirilir.
            <li
              key={`${sira}-${secenekMetni}`}
              dangerouslySetInnerHTML={{ __html: secenekMetni }}
            />
          ))}
        </ul>
      )}
      {metin && <div dangerouslySetInnerHTML={{ __html: metin }} />}
    </>
  )
}

// CevapSatiri: sıra numarası + soru metni + verilen cevabı tek bir liste öğesinde
// gösterir. props: soru -> sunucudan gelen soru/cevap kaydı; sira -> 1'den başlayan
// görünen sıra numarası; sonMu -> son öğede ayırıcı çizgi çizilmesin diye.
function CevapSatiri({ soru, sira, sonMu }) {
  return (
    <Flex vertical gap={6}>
      <Flex gap={8}>
        <Text strong>{`${sira}.`}</Text>
        {/* soru_metni SUNUCUDA sanitize edilmiş HTML'dir. */}
        <Text strong>
          <span dangerouslySetInnerHTML={{ __html: soru.soru_metni }} />
        </Text>
      </Flex>
      <VerilenCevap soru={soru} />
      {!sonMu && <Divider style={{ margin: 0 }} />}
    </Flex>
  )
}

// AnketKullaniciCevaplariKutusu: seçilen kişinin anket cevaplarını modal içinde
// listeler.
// props: anket -> liste satırı ({ anket_id, ad }); kullanici -> { kullanici_kodu,
// ad, soyad }; onKapat() -> perde/Kapat/Escape ile kapanınca çağrılır (üst bileşen
// kutuyu kaldırır ve atama kutusuna geri döner).
function AnketKullaniciCevaplariKutusu({ anket, kullanici, onKapat }) {
  const kisiAdi = adSoyadBirlestir(kullanici.ad, kullanici.soyad)
  const kutuBasligi = `${kisiAdi} — ${anket.ad}`

  const {
    data: cevaplar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anket-kullanici-cevaplari', anket.anket_id, kullanici.kullanici_kodu],
    queryFn: () =>
      kullaniciCevaplariniGetir(anket.anket_id, kullanici.kullanici_kodu),
  })

  const sorular = cevaplar?.sorular ?? []

  return (
    <Modal
      open
      title={`Cevaplar — ${kutuBasligi}`}
      width={KUTU_GENISLIGI}
      onCancel={onKapat}
      footer={<Button onClick={onKapat}>Kapat</Button>}
    >
      {isPending && <Spin />}

      {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {isError && (
        <Alert type="error" showIcon title={error.message} role="alert" />
      )}

      {!isPending && !isError && (
        <Flex vertical gap={12}>
          {/* Kişi anketi tamamlamamışsa cevaplar eksik olabilir; bu bilgi
              sunucudan gelir (tamamlandi_mi), UI yorum üretmez. */}
          {cevaplar.tamamlandi_mi === false && (
            <Alert
              type="info"
              showIcon
              role="status"
              title="Bu kişi anketi tamamlamamış; cevaplar eksik olabilir."
            />
          )}

          {sorular.length === 0 ? (
            <Empty description="Bu ankette gösterilecek soru bulunamadı." />
          ) : (
            <Flex vertical gap={12}>
              {sorular.map((soru, sira) => (
                <CevapSatiri
                  key={soru.soru_id}
                  soru={soru}
                  sira={sira + 1}
                  sonMu={sira === sorular.length - 1}
                />
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </Modal>
  )
}

export default AnketKullaniciCevaplariKutusu
