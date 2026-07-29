// Ankete atanmış kullanıcının bir anketi açtığında geldiği doldurma (cevaplama)
// sayfası. Yalnızca sunum sorumluluğundadır: rota parametresinden anket kimliğini
// okur, anketi backend'den çeker (React Query) ve durumuna göre yükleniyor / hata /
// tamamlanmış / doldurulabilir görünümünü gösterir. Cevap toplama ve gönderme işi
// alt bileşen AnketDoldurForm'a devredilir. İş kuralı, hesaplama veya doğrulama
// İÇERMEZ (otorite sunucudur); yalnızca gösterim ve alt bileşene veri/callback
// aktarır. Görünüm Ant Design bileşenleriyle kurulur (Card/Typography/Spin/Alert);
// tema ConfigProvider token'larından gelir, bu sayfaya ait özel CSS dosyası
// YOKTUR. Standalone rota olduğu için (bkz. D12) ayrıca ConfigProvider/App
// sarmalayıcı EKLENMEZ.

import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Card, Flex, Spin, Typography, theme } from 'antd'
import { anketDoldurGetir } from '../api/anketApi.js'
import AnketDoldurForm from '../components/AnketDoldurForm'

const { Title } = Typography

// KART_GENISLIGI: içerik kartının en fazla genişliği; uzun soru metinleri ve
// şıklar rahat okunsun diye sınırlanır.
const KART_GENISLIGI = 760

// AnketDoldurPage: anketId'yi rota parametresinden okuyup anketi çeker ve uygun
// görünümü çizer. Başarılı gönderimde ana ekrana döner (kart panelden düşer).
function AnketDoldurPage() {
  const { anketId } = useParams()
  const navigate = useNavigate()
  const { token } = theme.useToken()

  const {
    data: anket,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['anketDoldur', anketId],
    queryFn: () => anketDoldurGetir(anketId),
  })

  // onGonderimBasarili: cevaplar kaydedilince ana ekrana yönlendirir; kullanıcı
  // orada güncel (tamamlanan anketin düştüğü) paneli görür.
  function onGonderimBasarili() {
    navigate('/')
  }

  const sayfaStili = {
    minHeight: '100vh',
    background: token.colorBgLayout,
    padding: '32px 16px',
  }

  if (isPending) {
    return (
      <Flex justify="center" style={sayfaStili}>
        <Spin size="large" role="status" aria-label="Anket yükleniyor" />
      </Flex>
    )
  }

  if (isError) {
    return (
      <Flex justify="center" style={sayfaStili}>
        <Card style={{ width: '100%', maxWidth: KART_GENISLIGI }}>
          <Flex vertical gap={16}>
            {/* error.message backend'in güvenli mesajıdır (404 -> "Anket
                bulunamadı." gibi); teknik detay/stack sızmaz. */}
            <Alert type="error" showIcon title={error.message} role="alert" />
            <Link to="/" style={{ color: token.colorPrimary }}>
              Ana ekrana dön
            </Link>
          </Flex>
        </Card>
      </Flex>
    )
  }

  return (
    <Flex justify="center" style={sayfaStili}>
      <Card style={{ width: '100%', maxWidth: KART_GENISLIGI }}>
        <Flex vertical gap={16}>
          <Link to="/" style={{ color: token.colorPrimary, fontSize: 14 }}>
            ← Ana ekrana dön
          </Link>

          <Title level={3} style={{ margin: 0 }}>
            {anket.ad}
          </Title>

          {/* Anket açılış metni (varsa) sunucuda sanitize edilmiş HTML olabilir. */}
          {anket.on_yazi ? <div dangerouslySetInnerHTML={{ __html: anket.on_yazi }} /> : null}

          {anket.tamamlandi_mi ? (
            <Alert
              type="info"
              showIcon
              role="status"
              title="Bu anketi zaten tamamladınız. Cevaplarınız kaydedildi."
            />
          ) : null}

          <AnketDoldurForm
            anket={anket}
            onBasarili={onGonderimBasarili}
            saltOkunur={anket.tamamlandi_mi}
          />

          {/* Kapanış metni (varsa) sunucuda sanitize edilmiş HTML olabilir. */}
          {anket.son_yazi ? <div dangerouslySetInnerHTML={{ __html: anket.son_yazi }} /> : null}
        </Flex>
      </Card>
    </Flex>
  )
}

export default AnketDoldurPage
