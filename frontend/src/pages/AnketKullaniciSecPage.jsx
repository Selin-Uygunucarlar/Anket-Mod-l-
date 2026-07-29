// Anket formunun "Kullanıcılar" kartındaki "Listeden seç" bağlantısıyla YENİ
// SEKMEDE açılan kullanıcı seçme ekranı (/anket-kullanicilari-sec). Yalnızca sunum
// sorumluluğundadır: kullanıcı listesini kullaniciApi üzerinden ister, işaretlenenleri
// toplar ve açan sekmeye postMessage ile geri gönderip kendini kapatır; iş kuralı,
// yetki veya hesaplama İÇERMEZ (yetki sunucuda). Mevcut KullaniciListesi bilinçli
// olarak DEĞİŞTİRİLMEZ/yeniden kullanılmaz: orada düzenle/durum işlemleri vardır,
// seçim modu o bileşeni karmaşıklaştırırdı (SRP).
// Görünüm Ant Design bileşenleriyle kurulur (Table + rowSelection / Button / Alert /
// Typography); tema ConfigProvider token'larından gelir, bu sayfaya ait özel CSS
// dosyası YOKTUR (styles/soru-sec.css antd'ye geçişte silindi). SoruSecPage ile aynı
// kalıp: yükleniyor / hata / boş durumları ele alınır, yalnızca güvenli mesaj
// gösterilir, açan sekme yoksa buton yerine bilgilendirme çıkar.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Flex, Table, Typography } from 'antd'
import { listKullanicilar } from '../api/kullaniciApi.js'
import { buyukHarfeCevir } from '../common/metinBicimlendir.js'
import {
  KULLANICI_SECIM_MESAJ_TIPI,
  acanSekmeVarMi,
  secimiAcanSekmeyeGonder,
} from '../common/secimSekmesi.js'

const { Title, Text } = Typography

// Sayfa çerçevesi: tek başına açılan sekmede zemin ve nefes payı anasayfa içerik
// alanıyla aynı olsun diye tam yükseklik + 24px iç boşluk (yeni CSS dosyası
// açılmaz, inline stille kurulur).
const SAYFA_STILI = { padding: 24, background: '#ffffff', minHeight: '100vh' }

// Tablo sütunları: sicil, ad soyad ve e-posta. Seçim kolonu antd'nin
// rowSelection'ından gelir.
const SUTUNLAR = [
  {
    title: 'Sicil',
    dataIndex: 'kullanici_kodu',
    key: 'kullanici_kodu',
  },
  {
    title: 'Ad Soyad',
    key: 'ad_soyad',
    render: (_, kullanici) =>
      `${buyukHarfeCevir(kullanici.ad)} ${buyukHarfeCevir(kullanici.soyad)}`,
  },
  {
    title: 'E-posta',
    dataIndex: 'email',
    key: 'email',
  },
]

// AnketKullaniciSecPage: kullanıcı listesini gösterir ve işaretlenenleri açan
// sekmeye aktarır.
function AnketKullaniciSecPage() {
  // İşaretli kullanıcıların sicil kodları. Aktarımda liste sırası korunur.
  const [secililer, setSecililer] = useState([])

  const {
    data: kullanicilar,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['kullanicilar'],
    queryFn: listKullanicilar,
  })

  // Açan sekme var mı? Yoksa (kullanıcı bu adresi doğrudan açtıysa) seçim
  // aktarılacak bir hedef yoktur; buton yerine bilgilendirme gösterilir.
  const acanSekmeVar = acanSekmeVarMi()

  // secilenleriAktar: işaretli kullanıcıları açan sekmeye (anket formuna) gönderir
  // ve sekmeyi kapatır. Yalnızca formun gösterdiği alanlar taşınır; sıra listedeki
  // görünüm sırasıdır, işaretleme sırası değildir.
  function secilenleriAktar() {
    const secilenKullanicilar = (kullanicilar ?? [])
      .filter((kullanici) => secililer.includes(kullanici.kullanici_kodu))
      .map((kullanici) => ({
        kullanici_kodu: kullanici.kullanici_kodu,
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        email: kullanici.email,
      }))
    secimiAcanSekmeyeGonder({
      tip: KULLANICI_SECIM_MESAJ_TIPI,
      kullanicilar: secilenKullanicilar,
    })
  }

  const kullaniciListesi = kullanicilar ?? []

  return (
    <Flex vertical gap={16} style={SAYFA_STILI}>
      <Title level={2} style={{ margin: 0, fontSize: 20 }}>
        Ankete Eklenecek Kullanıcıları Seçin
      </Title>

      {/* error.message backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {isError ? (
        <Alert type="error" showIcon title={error.message} role="alert" />
      ) : (
        <Table
          rowKey="kullanici_kodu"
          columns={SUTUNLAR}
          dataSource={kullaniciListesi}
          rowSelection={{
            selectedRowKeys: secililer,
            onChange: setSecililer,
            getCheckboxProps: () => ({ 'aria-label': 'Bu kullanıcıyı ankete ekle' }),
          }}
          loading={isPending}
          pagination={false}
          locale={{ emptyText: 'Kayıtlı kullanıcı bulunamadı.' }}
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
            kullanıcı ekleyebilir. Lütfen anket formuna dönüp oradan açın.
          </Text>
        )}
      </Flex>
    </Flex>
  )
}

export default AnketKullaniciSecPage
