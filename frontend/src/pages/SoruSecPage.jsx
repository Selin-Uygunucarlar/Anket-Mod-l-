// Anket formunun "Yüklemek için tıklayınız" bağlantısıyla YENİ SEKMEDE açılan soru
// seçme ekranı (/anket-sorulari-sec). Yalnızca sunum sorumluluğundadır: soru
// havuzunu soruApi üzerinden ister, işaretlenenleri toplar ve açan sekmeye
// (window.opener) postMessage ile geri gönderip kendini kapatır; iş kuralı, yetki
// veya hesaplama İÇERMEZ (yetki sunucuda). Mevcut SoruListesi bilinçli olarak
// DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada düzenle/sil işlemleri vardır, seçim modu
// o bileşeni karmaşıklaştırırdı (SRP).
// Görünüm Ant Design bileşenleriyle kurulur (Table + rowSelection / Button / Alert /
// Typography); tema ConfigProvider token'larından gelir, bu sayfaya ait özel CSS
// dosyası YOKTUR (styles/soru-sec.css antd'ye geçişte silindi). soru-listesi.css
// import'u KALIR: soru gövdesi (.soru-metni-icerik) SoruListesi ile aynı görünsün
// diye (DRY, bilinçli). Sekme doğrudan (açan sekme olmadan) açılmışsa seçim
// aktarılamayacağı için buton yerine bilgilendirme gösterilir.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Flex, Table, Typography } from 'antd'
import { sorulariGetir } from '../api/soruApi.js'
import { soruTipiEtiketi } from '../common/soruTipleri.js'
import {
  SORU_SECIM_MESAJ_TIPI,
  acanSekmeVarMi,
  secimiAcanSekmeyeGonder,
} from '../common/secimSekmesi.js'
import '../styles/soru-listesi.css'

const { Title, Text } = Typography

// Sayfa çerçevesi: tek başına açılan sekmede zemin ve nefes payı anasayfa içerik
// alanıyla aynı olsun diye tam yükseklik + 24px iç boşluk (yeni CSS dosyası
// açılmaz, inline stille kurulur).
const SAYFA_STILI = { padding: 24, background: '#ffffff', minHeight: '100vh' }

// Tablo sütunları: soru metni sanitize HTML olarak, soru tipi Türkçe etiketle
// gösterilir. Seçim kolonu antd'nin rowSelection'ından gelir.
const SUTUNLAR = [
  {
    title: 'Soru Metni',
    dataIndex: 'soru_metni',
    key: 'soru_metni',
    // soru_metni SUNUCUDA sanitize edilmiş HTML'dir; UI yeniden sanitize
    // etmez/işlemez (SoruListesi ile aynı kalıp).
    render: (soruMetni) => (
      <div
        className="soru-metni-icerik"
        dangerouslySetInnerHTML={{ __html: soruMetni }}
      />
    ),
  },
  {
    title: 'Soru Tipi',
    dataIndex: 'soru_tipi',
    key: 'soru_tipi',
    render: (soruTipi) => soruTipiEtiketi(soruTipi),
  },
]

// SoruSecPage: soru havuzunu listeler ve işaretlenen soruları açan sekmeye aktarır.
function SoruSecPage() {
  // İşaretli soru kimlikleri. Sıra, kullanıcının işaretleme sırası değil listedeki
  // görünüm sırasıdır (aktarımda liste sırası korunur).
  const [secililer, setSecililer] = useState([])

  const {
    data: sorular,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['sorular'],
    queryFn: sorulariGetir,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = acanSekmeVarMi()

  // secilenleriAktar: işaretli soruları açan sekmeye (anket formuna) gönderir ve
  // sekmeyi kapatır (gönderim ayrıntısı secimSekmesi yardımcısındadır). Sıra
  // listedeki görünüm sırasıdır, işaretleme sırası değildir.
  function secilenleriAktar() {
    const secilenSorular = (sorular ?? [])
      .filter((soru) => secililer.includes(soru.soru_id))
      .map((soru) => ({
        soru_id: soru.soru_id,
        soru_metni: soru.soru_metni,
        soru_tipi: soru.soru_tipi,
      }))
    secimiAcanSekmeyeGonder({
      tip: SORU_SECIM_MESAJ_TIPI,
      sorular: secilenSorular,
    })
  }

  const soruListesi = sorular ?? []

  return (
    <Flex vertical gap={16} style={SAYFA_STILI}>
      <Title level={2} style={{ margin: 0, fontSize: 20 }}>
        Ankete Eklenecek Soruları Seçin
      </Title>

      {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {isError ? (
        <Alert type="error" showIcon title={error.message} role="alert" />
      ) : (
        <Table
          rowKey="soru_id"
          columns={SUTUNLAR}
          dataSource={soruListesi}
          rowSelection={{
            selectedRowKeys: secililer,
            onChange: setSecililer,
            getCheckboxProps: () => ({ 'aria-label': 'Bu soruyu ankete ekle' }),
          }}
          loading={isPending}
          pagination={false}
          locale={{ emptyText: 'Kayıtlı soru bulunamadı.' }}
        />
      )}

      <Flex justify={acanSekmeVar ? 'flex-end' : 'flex-start'}>
        {acanSekmeVar ? (
          <Button
            type="primary"
            disabled={secililer.length === 0}
            onClick={secilenleriAktar}
          >
            Seçilenleri Ekle
          </Button>
        ) : (
          <Text type="secondary">
            Bu ekran, anket formundaki "Yüklemek için tıklayınız" bağlantısıyla
            açıldığında soru ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

export default SoruSecPage
