// Anket formunun "Kullanıcılar" kartındaki "Kullanıcı Grupları" satırının
// "Listeden seç" bağlantısıyla YENİ SEKMEDE açılan grup seçme ekranı
// (/anket-gruplari-sec). Yalnızca sunum sorumluluğundadır: grup listesini grupApi
// üzerinden ister, işaretlenenleri toplar ve açan sekmeye postMessage ile geri
// gönderip kendini kapatır; iş kuralı, yetki veya hesaplama İÇERMEZ (yetki
// sunucuda). Mevcut grup yönetim ekranı DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada
// ekleme/silme/üye atama vardır, seçim modu onu karmaşıklaştırırdı (SRP).
// Görünüm Ant Design bileşenleriyle kurulur (Table + rowSelection / Button / Alert /
// Typography); tema ConfigProvider token'larından gelir, bu sayfaya ait özel CSS
// dosyası YOKTUR (styles/soru-sec.css antd'ye geçişte silindi). SoruSecPage ile aynı
// kalıp: yükleniyor / hata / boş durumları ele alınır, yalnızca güvenli mesaj
// gösterilir, açan sekme yoksa buton yerine bilgilendirme çıkar.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Flex, Table, Typography } from 'antd'
import { listGruplar } from '../api/grupApi.js'
import {
  GRUP_SECIM_MESAJ_TIPI,
  acanSekmeVarMi,
  secimiAcanSekmeyeGonder,
} from '../common/secimSekmesi.js'

const { Title, Text } = Typography

// Sayfa çerçevesi: tek başına açılan sekmede zemin ve nefes payı anasayfa içerik
// alanıyla aynı olsun diye tam yükseklik + 24px iç boşluk (yeni CSS dosyası
// açılmaz, inline stille kurulur).
const SAYFA_STILI = { padding: 24, background: '#ffffff', minHeight: '100vh' }

// Tablo sütunları: grup adı ve üye sayısı. Seçim kolonu antd'nin rowSelection'ından
// gelir.
const SUTUNLAR = [
  {
    title: 'Grup Adı',
    dataIndex: 'ad',
    key: 'ad',
  },
  {
    title: 'Üye Sayısı',
    dataIndex: 'uye_sayisi',
    key: 'uye_sayisi',
  },
]

// AnketGrupSecPage: kullanıcı gruplarını listeler ve işaretlenenleri açan sekmeye
// aktarır.
function AnketGrupSecPage() {
  // İşaretli grup kimlikleri. Aktarımda liste sırası korunur.
  const [secililer, setSecililer] = useState([])

  const {
    data: gruplar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['gruplar'],
    queryFn: listGruplar,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = acanSekmeVarMi()

  // secilenleriAktar: işaretli grupları açan sekmeye (anket formuna) gönderir ve
  // sekmeyi kapatır. Yalnızca formun gösterdiği alanlar taşınır; sıra listedeki
  // görünüm sırasıdır, işaretleme sırası değildir.
  function secilenleriAktar() {
    const secilenGruplar = (gruplar ?? [])
      .filter((grup) => secililer.includes(grup.grup_id))
      .map((grup) => ({
        grup_id: grup.grup_id,
        ad: grup.ad,
        uye_sayisi: grup.uye_sayisi,
      }))
    secimiAcanSekmeyeGonder({
      tip: GRUP_SECIM_MESAJ_TIPI,
      gruplar: secilenGruplar,
    })
  }

  const grupListesi = gruplar ?? []

  return (
    <Flex vertical gap={16} style={SAYFA_STILI}>
      <Title level={2} style={{ margin: 0, fontSize: 20 }}>
        Ankete Eklenecek Kullanıcı Gruplarını Seçin
      </Title>

      {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {isError ? (
        <Alert type="error" showIcon title={error.message} role="alert" />
      ) : (
        <Table
          rowKey="grup_id"
          columns={SUTUNLAR}
          dataSource={grupListesi}
          rowSelection={{
            selectedRowKeys: secililer,
            onChange: setSecililer,
            getCheckboxProps: () => ({ 'aria-label': 'Bu grubu ankete ekle' }),
          }}
          loading={isPending}
          pagination={false}
          locale={{ emptyText: 'Kayıtlı grup bulunamadı.' }}
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
            Bu ekran, anket formundaki "Listeden seç" bağlantısıyla açıldığında
            grup ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

export default AnketGrupSecPage
