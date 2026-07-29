// Ana ekran "Anketler" paneli. Giriş yapan kullanıcıya atanmış, aktif ve henüz
// tamamlanmamış anketleri yatay kutular halinde salt gösterim olarak sunar.
// Yalnızca sunum sorumluluğundadır: veriyi anketApi üzerinden ister ve gösterir;
// iş kuralı, yetki kontrolü veya hesaplama İÇERMEZ (kime hangi anketin atandığı
// sunucuda çözülür). Yükleniyor / hata / boş / dolu durumları sade biçimde ele
// alınır; kullanıcıya yalnızca güvenli mesaj gösterilir. Kutular tıklanabilir:
// bir kutuya tıklanınca (veya klavyeyle Enter/Space) ilgili anketin sayfasına
// (/anket/{anket_id}) gidilir.
// Görünüm Ant Design bileşenleriyle kurulur (Card/Flex/Spin/Alert/Empty); renk ve
// köşe değerleri ConfigProvider tema token'larından gelir, bu bileşene ait özel
// CSS dosyası YOKTUR. Veri çekme biçimi (useEffect + useState + iptal bayrağı)
// bilinçli olarak DEĞİŞTİRİLMEDİ; bu adımın konusu yalnızca görünümdür.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Card, Empty, Flex, Spin, Typography, theme } from 'antd'
import { atanmisAnketleriGetir } from '../api/anketApi.js'
import anketGorseli from '../assets/anket.png'

const { Title, Text } = Typography

// KUTU_GORSELI: her anket kutusunun üstünde gösterilen görsel; tüm kutular ortak
// anket görselini (anket.png) gösterir. Görseli değiştirmek için yalnızca burası
// güncellenir.
const KUTU_GORSELI = anketGorseli

// KUTU_STILI: geniş ekranda satır başına 5 kutu sığacak taban genişlik (4 boşluk *
// 16px, 5 kutuya bölünür); pencere daraldıkça Flex wrap ile daha az kutu sığar.
const KUTU_STILI = { flex: '0 0 calc((100% - 4 * 16px) / 5)', minWidth: 120 }

// AtanmisAnketPaneli: mount olunca atanmış anketleri çeker ve durumuna göre
// yükleniyor / hata / boş / kutu ızgarası gösterir. Veri kaynağı yalnızca
// anketApi'dir; props almaz.
function AtanmisAnketPaneli() {
  const [anketler, setAnketler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hataMesaji, setHataMesaji] = useState('')
  // Klavyeyle odaklanılan kutuyu işaretlemek için (odak halkası çizimi); antd
  // Card'a özel bir odak stili olmadığından burada elle takip edilir.
  const [odaklananAnketId, setOdaklananAnketId] = useState(null)
  const navigate = useNavigate()
  const { token } = theme.useToken()

  // anketiAc: seçilen anketin sayfasına yönlendirir. Yalnızca gezinme yapar;
  // veri işleme veya karar İÇERMEZ.
  function anketiAc(anketId) {
    navigate(`/anket/${anketId}`)
  }

  // klavyeIleAc: kutu odaktayken Enter/Space ile de anketin açılmasını sağlar
  // (buton gibi erişilebilir davranış). Sayfanın kaymasını önlemek için Space'te
  // varsayılan davranışı iptal eder.
  function klavyeIleAc(olay, anketId) {
    if (olay.key === 'Enter' || olay.key === ' ') {
      olay.preventDefault()
      anketiAc(anketId)
    }
  }

  useEffect(() => {
    // Bileşen kaldırıldıysa state güncellemesini atlamak için iptal bayrağı.
    let iptalEdildi = false

    async function anketleriYukle() {
      setYukleniyor(true)
      setHataMesaji('')
      try {
        const gelenAnketler = await atanmisAnketleriGetir()
        if (!iptalEdildi) setAnketler(gelenAnketler ?? [])
      } catch (hata) {
        // hata.message backend'in / anketApi'nin güvenli mesajıdır; teknik detay yok.
        if (!iptalEdildi) setHataMesaji(hata.message)
      } finally {
        if (!iptalEdildi) setYukleniyor(false)
      }
    }

    anketleriYukle()
    return () => {
      iptalEdildi = true
    }
  }, [])

  return (
    <Flex vertical gap={16}>
      <Title level={2} style={{ margin: 0, fontSize: 20 }}>
        Anketler
      </Title>

      {yukleniyor && (
        <Flex align="center" gap={8} role="status" aria-live="polite">
          <Spin size="small" />
          <Text type="secondary">Yükleniyor...</Text>
        </Flex>
      )}

      {/* hataMesaji backend'in güvenli mesajıdır; teknik detay sızmaz. */}
      {!yukleniyor && hataMesaji && (
        <Alert type="error" showIcon title={hataMesaji} role="alert" />
      )}

      {!yukleniyor && !hataMesaji && anketler.length === 0 && (
        <Empty description="Size atanmış bekleyen anket yok." />
      )}

      {!yukleniyor && !hataMesaji && anketler.length > 0 && (
        <Flex wrap="wrap" gap={16}>
          {anketler.map((anket) => {
            const odaklandi = odaklananAnketId === anket.anket_id
            return (
              <Card
                key={anket.anket_id}
                hoverable
                role="button"
                tabIndex={0}
                onClick={() => anketiAc(anket.anket_id)}
                onKeyDown={(olay) => klavyeIleAc(olay, anket.anket_id)}
                onFocus={() => setOdaklananAnketId(anket.anket_id)}
                onBlur={() =>
                  setOdaklananAnketId((oncekiId) =>
                    oncekiId === anket.anket_id ? null : oncekiId,
                  )
                }
                style={{
                  ...KUTU_STILI,
                  outline: odaklandi ? `2px solid ${token.colorPrimary}` : 'none',
                  outlineOffset: 2,
                }}
                styles={{ body: { padding: '12px 14px' } }}
                cover={<img src={KUTU_GORSELI} alt="" aria-hidden="true" />}
              >
                <Text strong style={{ fontSize: 18 }}>
                  {anket.ad}
                </Text>
              </Card>
            )
          })}
        </Flex>
      )}
    </Flex>
  )
}

export default AtanmisAnketPaneli
